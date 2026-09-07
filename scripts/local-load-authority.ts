import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BelayRoom } from '../server/BelayRoom';
import { initializePhysics } from '../shared/simulation';
import { issueAccess } from '../server/auth';
import { TUNING } from '../tuning';
import type { Snapshot } from '../shared/protocol';

type ExistingReport = { state: Snapshot; [key: string]: unknown };
type FixtureRoom = { report: () => ExistingReport };

export class LoadAuthority {
  private server?: Server;
  private http = http.createServer();
  async initialize() {
    // Entirely private to this child. Tokens travel over inherited IPC, never argv, disk, or logs.
    process.env.BELAY_SESSION_SECRET = randomBytes(TUNING.server.tokenBytes).toString('hex');
    await initializePhysics();
    this.server = new Server({ transport: new WebSocketTransport({ server: this.http, maxPayload: TUNING.network.maximumFrameBytes }),
      greet: false, gracefullyShutdown: false });
    this.server.define('belay', BelayRoom);
    await this.server.listen(0, '127.0.0.1');
    return { endpoint: `ws://127.0.0.1:${(this.http.address() as { port: number }).port}`,
      operatorToken: issueAccess('operator'), testerToken: issueAccess('tester'), pid: process.pid };
  }
  async inspect(detailed = false) {
    const listed = await matchMaker.query({ name: 'belay' });
    let connected = 0, totalBufferedBytes = 0, maximumBufferedBytes = 0;
    const rooms = listed.flatMap(row => {
      const room = matchMaker.getLocalRoomById(row.roomId);
      if (!room) return [];
      connected += room.clients.length;
      for (const client of room.clients) {
        const buffered = (client.ref as unknown as { bufferedAmount?: number }).bufferedAmount ?? 0;
        totalBufferedBytes += buffered; maximumBufferedBytes = Math.max(maximumBufferedBytes, buffered);
      }
      // Read-only fixture inspection of existing metrics. No callbacks/clock/solver are replaced.
      const report = (room as unknown as FixtureRoom).report();
      const { state, processMemory: _processMemory, ...counters } = report;
      return [{ roomId: row.roomId, tick: state.tick, epoch: state.epoch, scene: state.scene ?? 'flat', seed: state.seed,
        playerCount: state.players.length, connected: state.players.filter(player => player.connected).length,
        acceptedInputs: typeof report.acceptedInputs === 'number' ? report.acceptedInputs : null,
        rejectedInputs: report.rejectedInputs, droppedWallMs: report.droppedWallMs, skippedTickSlots: report.skippedTickSlots ?? null,
        snapshotDeliveries: report.snapshotDeliveries ?? null, snapshotJsonBytesTotal: report.snapshotJsonBytesTotal ?? null, skippedSnapshots: report.skippedSnapshots,
        timingRing: { execution: report.tickExecutionMs, scheduling: report.schedulingLatenessMs, combined: report.schedulingPlusExecutionMs,
          scope: 'Overlapping available completed-callback ring summaries; no raw per-slot stream or deduplicatable full-window timing.' },
        logicalStorage: { ropePoints: report.ropePointCount, tapeFrames: report.tapeFrames, tapeTruncated: report.tapeTruncated },
        ...(detailed ? { counters, finalAckBySeat: state.players.map(player => ({ id: player.id, ackSeq: player.ackSeq })) } : {}) }];
    });
    return { atMonoMs: performance.now(), worldCount: rooms.length, connected, totalBufferedBytes, maximumBufferedBytes, rooms };
  }
  async shutdown() { await this.server?.gracefullyShutdown(false); delete process.env.BELAY_SESSION_SECRET; }
}
