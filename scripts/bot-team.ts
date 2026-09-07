import { performance } from 'node:perf_hooks';
import type { Room } from '@colyseus/sdk';
import { TUNING } from '../tuning';
import { REST, type SimulationSnapshot } from '../shared/protocol';
import { localClient, observe } from './client-utils';
import { PHASE2_POLICIES, Phase2Policy } from './phase2-policies';
import type { PolicyName } from './phase2-analysis';

const args = process.argv.slice(2);
let policyName: PolicyName = 'bad', seconds: number = TUNING.gates.freePlayMinutes * 60;
for (let index = 0; index < args.length; index += 2) {
  if (args[index] === '--mode' && PHASE2_POLICIES.includes(args[index + 1] as PolicyName)) policyName = args[index + 1] as PolicyName;
  else if (args[index] === '--seconds' && Number.isFinite(Number(args[index + 1]))) seconds = Number(args[index + 1]);
  else throw new Error('Usage: npm run bot:team -- [--mode bad|recovery|walk|static-brace|frozen-tail] [--seconds duration]');
}
if (seconds <= 0 || seconds > TUNING.network.maximumTapeSeconds) throw new Error(`Duration must be positive and no longer than ${TUNING.network.maximumTapeSeconds} seconds.`);
const { client, config } = await localClient();
const rooms: Room[] = [];
const timers: ReturnType<typeof setInterval>[] = [];
const abort = new AbortController();
const stop = () => abort.abort();
process.on('SIGINT', stop); process.on('SIGTERM', stop);
let timeout: ReturnType<typeof setTimeout> | undefined;
try {
  let occupied = 0, capacity: number = TUNING.hardCap;
  do {
    abort.signal.throwIfAborted();
    const room = await client.joinById(config.roomId, { token: config.token, bot: true });
    room.reconnection.enabled = false; rooms.push(room);
    const observer = observe(room);
    let receivedAt = performance.now();
    room.onMessage('snapshot', () => { receivedAt = performance.now(); });
    room.onLeave(stop);
    await new Promise<void>((resolve, reject) => {
      const started = performance.now();
      const timer = setInterval(() => {
        if (abort.signal.aborted || performance.now() - started >= TUNING.network.joinTimeoutMs) {
          clearInterval(timer); reject(new Error('No ready game state for bot teammate.')); return;
        }
        if (observer.latest && observer.localId >= 0) { clearInterval(timer); resolve(); }
      }, 1000 / TUNING.network.inputHz);
    });
    const first = observer.latest as SimulationSnapshot;
    if (!first.players.some(player => player.connected && !player.label.startsWith('BOT '))) {
      throw new Error('Join the rope in a browser first; bot teammates leave a human-controlled seat to you.');
    }
    if (!first.scene || !first.run || !first.rope.spans) throw new Error('Bot teammates require the Phase 2 server.');
    capacity = first.players.length; occupied = first.players.filter(player => player.connected).length;
    let epoch = -1, policy: Phase2Policy, seq = 0;
    timers.push(setInterval(() => {
      if (!room.connection.isOpen || abort.signal.aborted) return;
      const state = observer.latest as SimulationSnapshot;
      let move = REST;
      if (performance.now() - receivedAt <= TUNING.network.staleSnapshotMs && state.players[observer.localId]
        && state.scene !== 'flat') {
        if (epoch !== state.epoch) {
          epoch = state.epoch;
          policy = new Phase2Policy({ ordinal: 0, seed: state.seed, family: state.family, scene: state.scene,
            playerCount: state.players.length, policy: policyName, tickHz: state.tickHz, horizonSeconds: seconds });
        }
        move = policy.inputs(state)[observer.localId] ?? REST;
      }
      room.send('input', { ...move, seq: seq++ });
    }, 1000 / TUNING.network.inputHz));
    console.log(`BOT ${observer.localId + 1} joined (${policyName}). ${occupied}/${capacity} occupied.`);
  } while (occupied < capacity);
  console.log(`Bot teammates active for at most ${seconds} seconds. They are synthetic partners, not human playtest evidence. Ctrl+C closes their seats.`);
  await new Promise<void>(resolve => {
    if (abort.signal.aborted) { resolve(); return; }
    abort.signal.addEventListener('abort', () => resolve(), { once: true });
    timeout = setTimeout(() => { stop(); resolve(); }, seconds * 1000);
  });
} finally {
  clearTimeout(timeout); timers.forEach(clearInterval); process.off('SIGINT', stop); process.off('SIGTERM', stop);
  await Promise.allSettled(rooms.filter(room => room.connection.isOpen).map(room => room.leave(false)));
  console.log('Bot teammate connections closed.');
}
