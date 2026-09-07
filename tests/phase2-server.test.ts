import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Server, matchMaker } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BelayRoom } from '../server/BelayRoom';
import { issueAccess } from '../server/auth';
import { observe, delay } from '../scripts/client-utils';
import { TUNING } from '../tuning';
import type { SimulationSnapshot, Tape } from '../shared/protocol';

const httpServer = http.createServer();
let server: Server, sdk: Client, token: string;
const clients: Room[] = [];
beforeAll(async () => {
  vi.stubEnv('BELAY_SESSION_SECRET', randomBytes(TUNING.server.tokenBytes).toString('hex'));
  server = new Server({ transport: new WebSocketTransport({ server: httpServer, maxPayload: TUNING.network.maximumFrameBytes }), greet: false, gracefullyShutdown: false });
  server.define('belay', BelayRoom); await server.listen(0, TUNING.server.host);
  sdk = new Client(`ws://${TUNING.server.host}:${(httpServer.address() as { port: number }).port}`);
  token = issueAccess('operator');
});
afterEach(async () => {
  await Promise.allSettled(clients.splice(0).filter(client => client.connection.isOpen).map(client => client.leave(false)));
  await delay(30);
});
afterAll(async () => { await server.gracefullyShutdown(false); vi.unstubAllEnvs(); });
function track(room: Room) { room.reconnection.enabled = false; clients.push(room); return observe(room); }

describe('Phase 2 real-room scene integration', () => {
  it('allocates six distinct climbers and five physical spans and rejects a seventh', async () => {
    const owner = await sdk.create('belay', { token, scene: 'rescue', playerCount: 6 }), a = track(owner);
    await a.command('pause');
    const others = [];
    for (let i = 1; i < TUNING.hardCap; i++) others.push(track(await sdk.joinById(owner.roomId, { token: issueAccess('tester') })));
    await vi.waitFor(() => expect(a.latest?.players.filter(player => player.connected)).toHaveLength(6));
    expect(new Set([a, ...others].map(observer => observer.localId)).size).toBe(6);
    const state = a.latest as SimulationSnapshot;
    expect(state.playerCount).toBe(6); expect(state.scene).toBe('rescue'); expect(state.rope.spans).toHaveLength(5);
    expect(state.rope.spans.map(span => [span.a, span.b])).toEqual([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]);
    expect(state.terrain.crevasses.length).toBeGreaterThan(0);
    await expect(sdk.joinById(owner.roomId, { token })).rejects.toThrow();
    await expect(others[0].command('loadScene', { scene: 'flat', playerCount: 2 })).rejects.toThrow('restricted');
    expect(matchMaker.getLocalRoomById(owner.roomId)?.maxClients).toBe(6);
  });

  it('preserves scene, team and seats across seed changes and refuses occupied-body deletion', async () => {
    const owner = await sdk.create('belay', { token, scene: 'crossing', playerCount: 6 }), a = track(owner);
    await a.command('pause');
    const peers: Room[] = [];
    for (let i = 1; i < TUNING.hardCap; i++) { const room = await sdk.joinById(owner.roomId, { token }); track(room); peers.push(room); }
    await vi.waitFor(() => expect(a.latest?.players.filter(player => player.connected)).toHaveLength(6));
    await Promise.all(peers.slice(0, -1).map(room => room.leave(false)));
    await vi.waitFor(() => expect(a.latest?.players.filter(player => player.connected)).toHaveLength(2));
    await expect(a.command('loadScene', { playerCount: 2 })).rejects.toThrow('Climber 6');
    const reseeded = await a.command('setSeed', 8) as SimulationSnapshot;
    expect(reseeded.scene).toBe('crossing'); expect(reseeded.playerCount).toBe(6); expect(reseeded.seed).toBe(8);
    expect(reseeded.players.filter(player => player.connected).map(player => player.id)).toEqual([0, 5]);
    expect(reseeded.tick).toBe(0);
    await peers.at(-1)!.leave(false);
    await vi.waitFor(() => expect(a.latest?.players.filter(player => player.connected)).toHaveLength(1));
    const reduced = await a.command('loadScene', { playerCount: 2, scene: 'flat' }) as SimulationSnapshot;
    expect(reduced.players).toHaveLength(2); expect(reduced.rope.spans).toHaveLength(1);
    expect(matchMaker.getLocalRoomById(owner.roomId)?.maxClients).toBe(2);
    track(await sdk.joinById(owner.roomId, { token }));
    await expect(sdk.joinById(owner.roomId, { token })).rejects.toThrow();
    await a.command('loadScene', { playerCount: 4, scene: 'rescue' });
    track(await sdk.joinById(owner.roomId, { token })); // Increasing a full room unlocks it through Colyseus.
    expect(matchMaker.getLocalRoomById(owner.roomId)?.maxClients).toBe(4);
  });

  it('steps and tapes the authoritative rescue fixture without accepting client positions or hidden capacities', async () => {
    const owner = await sdk.create('belay', { token, scene: 'rescue', playerCount: 4 }), a = track(owner);
    await a.command('pause'); await a.command('loadScene', { seed: 22 });
    owner.send('input', { x: 0, z: 0, brace: true, seq: 1, position: { y: 0 } });
    const stepped = await a.command('stepTicks', 60) as SimulationSnapshot;
    const tape = await a.command('tape') as Tape;
    expect(stepped.tick).toBe(60); expect(stepped.diagnostics.incidentsStarted).toBeGreaterThan(0);
    expect(tape.scene).toBe('rescue'); expect(tape.playerCount).toBe(4); expect(tape.frames).toHaveLength(60);
    expect(tape.frames.every(frame => frame.inputs.length === 4)).toBe(true);
    const report = await a.command('counters') as { acceptedInputs: number; rejectedInputs: number };
    expect(report.acceptedInputs).toBe(0); expect(report.rejectedInputs).toBe(1);
    for (const bridge of stepped.terrain.bridges) {
      expect(Object.keys(bridge).some(key => /capacity|bodyWeights|loadN/.test(key))).toBe(false);
    }
    await expect(a.command('loadScene', { scene: 'crossing', bridgeCapacity: 999999 })).rejects.toThrow('Only');
    await expect(sdk.create('belay', { token, scene: 'crossing', playerCount: 7 })).rejects.toThrow();
  });
});
