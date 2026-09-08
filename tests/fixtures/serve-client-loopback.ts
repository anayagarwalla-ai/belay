import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server, matchMaker } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { BelayRoom } from '../../server/BelayRoom';
import { issueAccess } from '../../server/auth';
import { TUNING } from '../../tuning';
import { REST, type Move, type Snapshot } from '../../shared/protocol';
import { parseNetworkProfile, type NetworkProfile } from '../../server/impairment';
import { delayedLoopback } from './delayed-loopback';

// Isolated loopback-only audit harness. Real room/SDK/physics; pressure and partner seats are explicit test controls.
process.env.BELAY_SESSION_SECRET = randomBytes(TUNING.server.tokenBytes).toString('hex');
const token = issueAccess('operator'), partners: Room[] = [];
let roomId = '';
let profile: NetworkProfile = { addedRttMs: 0, jitterMs: 0 }, helperPolicy = false;
const partnerState = new Map<Room, Snapshot>(), partnerSequences = new Map<Room, number>();
const inspect = () => [...(authority as unknown as { seats: Map<string, { id: number; input: Move; seq: number }> }).seats.values()]
  .map(seat => ({ id: seat.id, input: seat.input, seq: seat.seq }));
const auditRoutes: http.RequestListener = (req, res) => {
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  if (req.url === '/belay/config') { res.end(JSON.stringify({ roomId, token, endpoint: '/game', operator: true })); return; }
  if (req.url === '/audit/state') { res.end(JSON.stringify(inspect())); return; }
  if (req.url !== '/audit/control' || req.method !== 'POST') { res.writeHead(404).end('{}'); return; }
  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > TUNING.server.maximumAuthBodyBytes) req.destroy(); });
  req.on('end', () => { void (async () => {
    const options = JSON.parse(body) as { pressure?: boolean; partners?: number; network?: NetworkProfile; helperPolicy?: boolean };
    if (options.network) profile = parseNetworkProfile(options.network);
    if (options.helperPolicy !== undefined) helperPolicy = options.helperPolicy;
    if (options.partners !== undefined) {
      if (!Number.isInteger(options.partners) || options.partners < 0 || options.partners >= TUNING.hardCap) throw new Error('Invalid audit partner count.');
      while (partners.length > options.partners) { const partner = partners.pop()!; partnerState.delete(partner); partnerSequences.delete(partner); await partner.leave(false); }
      while (partners.length < options.partners) {
        const partner = await sdk.joinById(roomId, { token, bot: true }); partner.reconnection.enabled = false;
        partner.onMessage('snapshot', (snapshot: Snapshot) => partnerState.set(partner, snapshot)); partner.onMessage('seat', () => {}); partners.push(partner);
      }
    }
    if (options.pressure !== undefined) for (const client of authority.clients) if (!partners.some(p => p.sessionId === client.sessionId)) {
      if (options.pressure) Object.defineProperty(client.ref, 'bufferedAmount', { configurable: true, get: () => TUNING.network.maximumSnapshotBufferedBytes + 1 });
      else delete (client.ref as typeof client.ref & { bufferedAmount?: number }).bufferedAmount;
    }
    res.end(JSON.stringify(inspect()));
  })().catch(error => { res.writeHead(400).end(JSON.stringify({ error: error instanceof Error ? error.message : 'Audit control failed.' })); }); });
};
const server = http.createServer();
const game = new Server({ transport: new WebSocketTransport({ server, maxPayload: TUNING.network.maximumFrameBytes }), greet: false, gracefullyShutdown: false,
  express: app => { app.use((req, res, next) => { if (req.url === '/belay/config' || req.url.startsWith('/audit/')) auditRoutes(req, res); else next(); }); } });
game.define('belay', BelayRoom); await game.listen(0, TUNING.server.host);
const authorityPort = (server.address() as { port: number }).port;
const delayed = await delayedLoopback(authorityPort, () => profile);
const sdk = new Client(`ws://${TUNING.server.host}:${delayed.port}`);
const room = await matchMaker.createRoom('belay', { token, persistent: true, scene: 'flat', playerCount: 6 }); roomId = room.roomId;
const authority = matchMaker.getLocalRoomById(roomId) as BelayRoom;
const helperTimer = setInterval(() => {
  if (!helperPolicy) return;
  const ids = new Map([...((authority as unknown as { seats: Map<string, { id: number }> }).seats)].map(([session, seat]) => [session, seat.id]));
  for (const partner of partners) {
    const state = partnerState.get(partner), own = state?.players.find(player => player.id === ids.get(partner.sessionId));
    if (!own || !state || !partner.connection.isOpen) continue;
    const gap = state.terrain?.crevasses[0];
    const input = state.paused || !gap ? REST : own.position.z < gap.minZ - TUNING.phase2.rescueSafeOffset ? { x: 0, z: 1, brace: false } : { ...REST, brace: true };
    const seq = partnerSequences.get(partner) ?? 0; partner.send('input', { ...input, seq }); partnerSequences.set(partner, seq + 1);
  }
}, 1000 / TUNING.network.inputHz);
const root = fileURLToPath(new URL('../../', import.meta.url));
const web = await createServer({ root, configFile: false, plugins: [react()], resolve: { alias: { '@': root } },
  css: { postcss: { plugins: [tailwindcss()] } }, server: { host: TUNING.server.host, port: 0, strictPort: true,
    fs: { deny: ['**/.env*', '**/.git/**', '**/work/**', '**/.tools/**'] }, proxy: {
      '/game': { target: `http://${TUNING.server.host}:${delayed.port}`, ws: true, rewrite: path => path.replace(/^\/game/, '') },
      '/audit': { target: `http://${TUNING.server.host}:${authorityPort}` },
    } } });
await web.listen();
console.log(`Isolated real loopback audit: http://${TUNING.server.host}:${(web.httpServer!.address() as { port: number }).port}/tests/fixtures/client-loopback.html`);
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { if (closing) return; closing = true; void (async () => {
  clearInterval(helperTimer); await Promise.allSettled(partners.map(partner => partner.leave(false))); await web.close(); await delayed.close(); await game.gracefullyShutdown(false); process.exit();
})(); });
