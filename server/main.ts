import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { TUNING } from '../tuning';
import type { Request, Response } from 'express';
import { BelayRoom } from './BelayRoom';
import { secret, sameSecret, issueAccess } from './auth';

secret();
let roomId = '';
const transport = new WebSocketTransport({ maxPayload: TUNING.network.maximumFrameBytes });
const server = new Server({ transport, greet: false, express: app => {
  app.get('/health', (_req: Request, res: Response) => res.json({ ok: Boolean(roomId), phase: TUNING.phase }));
  app.get('/belay/config', (req: Request, res: Response) => {
    if (!sameSecret(String(req.headers['x-belay-gateway'] ?? ''), secret())) { res.status(401).json({ error: 'Protected test connection required.' }); return; }
    const role = req.headers['x-belay-role'] === 'operator' ? 'operator' : 'tester';
    res.setHeader('Cache-Control', 'no-store');
    res.json({ roomId, token: issueAccess(role), operator: role === 'operator', endpoint: '/game' });
  });
} });
server.define('belay', BelayRoom);
await server.listen(TUNING.server.port, TUNING.server.host);
const room = await matchMaker.createRoom('belay', { persistent: true, token: issueAccess('operator'),
  scene: TUNING.phase2.defaultScene, playerCount: TUNING.phase2.defaultPlayers });
roomId = room.roomId;
console.log(`BELAY authority: http://${TUNING.server.host}:${TUNING.server.port} (Phase ${TUNING.phase}, ${TUNING.tickHz} Hz, ${TUNING.phase2.defaultPlayers} climbers)`);
