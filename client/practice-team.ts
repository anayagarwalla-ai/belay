import type { Room } from '@colyseus/sdk';
import { TUNING } from '../tuning';
import { REST, type SimulationSnapshot, type Snapshot } from '../shared/protocol';
import type { Phase2Policy } from '../scripts/phase2-policies';

export type PracticeMode = 'recovery' | 'bad';
export type PracticeStatus = { state: 'idle' | 'starting' | 'running'; count: number; message: string };
type Owner = { ready: boolean; id: number; snapshot?: Snapshot };
type Peer = { room: Room; id: number; snapshot?: Snapshot; receivedAt: number; seq: number; epoch: number; policy?: Phase2Policy };
type Session = { abort: AbortController; peers: Set<Peer>; deadline?: ReturnType<typeof setTimeout>;
  joinDeadline?: ReturnType<typeof setTimeout>; timer?: ReturnType<typeof setInterval> };

/** Reject promptly on cancellation; late SDK joins are closed by their own completion handler. */
function untilStopped<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => reject(signal.reason);
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop));
    if (signal.aborted) { reject(signal.reason); return; }
    signal.addEventListener('abort', stop, { once: true });
  });
}

/** Browser-owned diagnostic clients. Each occupies a real server seat and sends only normal inputs. */
export class PracticeTeam {
  status: PracticeStatus = { state: 'idle', count: 0, message: 'Synthetic teammates for local practice.' };
  private session?: Session;
  constructor(private owner: () => Owner, private changed: () => void) {}

  private publish(state: PracticeStatus['state'], count: number, message: string) {
    this.status = { state, count, message }; this.changed();
  }

  stop(message = 'Practice bots stopped.') {
    const session = this.session;
    if (!session) return;
    this.session = undefined;
    clearTimeout(session.deadline); clearTimeout(session.joinDeadline); clearInterval(session.timer);
    session.abort.abort(new Error(message));
    for (const peer of session.peers) this.close(peer.room);
    session.peers.clear();
    this.publish('idle', 0, message);
  }

  private close(room: Room) {
    room.reconnection.enabled = false;
    if (room.connection.isOpen) void room.leave(false).catch(() => {});
  }

  async start(mode: PracticeMode, join: () => Promise<Room>) {
    if (this.session) throw new Error('Practice bots are already starting or running.');
    if (mode !== 'recovery' && mode !== 'bad') throw new Error('Choose cooperative or clumsy practice bots.');
    const owner = this.owner();
    if (!owner.ready || !owner.snapshot) throw new Error('Join the rope and wait for fresh state first.');
    if (owner.snapshot.scene !== 'rescue' && owner.snapshot.scene !== 'crossing') throw new Error('Load a rescue or crossing scene first.');
    if (owner.snapshot.players.every(player => player.connected)) throw new Error('The rope is full. No human seats will be replaced.');
    const session: Session = { abort: new AbortController(), peers: new Set() };
    this.session = session;
    const current = () => this.session === session;
    session.joinDeadline = setTimeout(() => this.stop('Bot join timed out. Try again.'), TUNING.network.joinTimeoutMs);
    session.deadline = setTimeout(() => this.stop('Practice time limit reached. Add bots again to continue.'), TUNING.bot.practiceSeconds * 1000);
    this.publish('starting', 0, 'Adding bots to empty seats…');
    try {
      // Keep policy code out of the initial page load; this is the same public-state policy as bot:team.
      const { Phase2Policy } = await untilStopped(import('../scripts/phase2-policies'), session.abort.signal);
      let latest = owner.snapshot;
      for (let i = 0; i < TUNING.hardCap - 1 && latest.players.some(player => !player.connected); i++) {
        if (!this.owner().ready) throw new Error('The operator connection is no longer ready.');
        const arriving = join().then(room => {
          room.reconnection.enabled = false;
          if (!current()) this.close(room);
          else session.peers.add({ room, id: -1, receivedAt: performance.now(), seq: 0, epoch: -1 });
          return room;
        });
        const room = await untilStopped(arriving, session.abort.signal);
        if (!current()) return;
        const peer = [...session.peers].find(value => value.room === room)!;
        let ready!: () => void;
        const firstState = new Promise<void>(resolve => { ready = resolve; });
        const check = () => {
          if (peer.snapshot?.players.some(player => player.id === peer.id && player.connected)) ready();
        };
        const identity = ({ id }: { id: number }) => {
          if (!current() || !Number.isInteger(id) || id < 0 || id >= TUNING.hardCap) return;
          peer.id = id; check();
        };
        room.onMessage('seat', identity); room.onMessage('identity', identity);
        room.onMessage('snapshot', (snapshot: Snapshot) => {
          if (!current()) return;
          peer.snapshot = snapshot; peer.receivedAt = performance.now(); check();
        });
        const disconnected = () => { if (current()) this.stop('A practice bot disconnected. Add bots again when ready.'); };
        room.onLeave(disconnected); room.onDrop(disconnected); room.onError(disconnected);
        room.send('identify');
        await untilStopped(firstState, session.abort.signal);
        if (!current()) return;
        latest = peer.snapshot!;
        this.publish('starting', session.peers.size, `Added ${session.peers.size} practice bot(s)…`);
      }
      if (!current()) return;
      clearTimeout(session.joinDeadline);
      this.publish('running', session.peers.size, `${session.peers.size} practice bots · ${mode === 'recovery' ? 'cooperative' : 'clumsy'} · stop after ${TUNING.bot.practiceSeconds / 60} minutes`);
      session.timer = setInterval(() => {
        if (!current()) return;
        if (!this.owner().ready) { this.stop('Practice stopped: the operator connection is stale or closed.'); return; }
        try {
          for (const peer of session.peers) {
            const state = peer.snapshot;
            if (!peer.room.connection.isOpen || !state || performance.now() - peer.receivedAt > TUNING.network.staleSnapshotMs) {
              this.stop('Practice stopped: a bot is no longer receiving fresh state.'); return;
            }
            if (!state.players.some(player => player.id === this.owner().id && player.connected && !player.label.startsWith('BOT '))) {
              this.stop('Practice stopped: the human operator left the rope.'); return;
            }
            let move = REST;
            if (!state.paused && state.run?.status === 'active' && state.scene && state.scene !== 'flat' && state.terrain && state.rope.spans) {
              if (peer.epoch !== state.epoch) {
                peer.epoch = state.epoch;
                peer.policy = new Phase2Policy({ ordinal: 0, seed: state.seed, family: state.family, scene: state.scene,
                  playerCount: state.players.length, policy: mode, tickHz: state.tickHz, horizonSeconds: TUNING.bot.practiceSeconds });
              }
              move = peer.policy!.inputs(state as SimulationSnapshot)[peer.id] ?? REST;
            }
            peer.room.send('input', { ...move, seq: peer.seq++ });
          }
        } catch { this.stop('Practice bots stopped after a connection or policy error.'); }
      }, 1000 / TUNING.network.inputHz);
    } catch (error) {
      if (!current()) return; // Stop, navigation or a deadline already published the reason.
      const message = error instanceof Error ? error.message : 'Unable to add practice bots.';
      this.stop(message); throw new Error(message);
    }
  }
}
