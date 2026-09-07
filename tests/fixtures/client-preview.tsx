import { createRoot } from 'react-dom/client';
import GateClient from '../../client/GateClient';
import { BelayConnection } from '../../client/connection';
import type { SceneOptions, Snapshot, Support } from '../../shared/protocol';
import { phase2State } from './phase2-state';
import '../../app/globals.css';

// Loaded only by client-preview.html on a separate ephemeral fixture server. Never imported by the application.
let connection: BelayConnection | undefined;
const calls: unknown[] = [];
const emit = (state: Snapshot) => {
  if (!connection) return;
  const change = state.epoch !== connection.latest?.epoch;
  if (change) { connection.history = []; connection.input = { x: 0, z: 0, brace: false }; connection.onInputReset(); }
  connection.latest = state;
  connection.history.push({ at: performance.now(), state: structuredClone(state) });
  if (connection.history.length > 2) connection.history.shift();
  connection.evidence.receive(state, connection.localId); connection.onSnapshot(state); connection.onChange();
};
Object.defineProperty(BelayConnection.prototype, 'acceptsMovement', { get() { return Boolean(this.latest); } });
BelayConnection.prototype.join = async function () {
  // The isolated fixture deliberately captures the instance constructed inside the real component.
  // oxlint-disable-next-line typescript/no-this-alias
  connection = this; this.localId = 0; this.operator = true; this.status = 'Connected'; this.sessionNumber++;
  this.room = { roomId: 'synthetic-only', connection: { isOpen: true }, reconnection: { enabled: false }, leave: async () => {}, send: () => {} } as unknown as NonNullable<BelayConnection['room']>;
  emit(phase2State());
};
BelayConnection.prototype.command = async function (command, value) {
  calls.push({ command, value });
  if (command === 'loadScene') {
    const options = value as SceneOptions;
    const next = phase2State(options.playerCount, options.scene);
    next.epoch = (this.latest?.epoch ?? 0) + 1; next.family = options.family ?? next.family; next.seed = options.seed ?? next.seed; next.tickHz = options.tickHz ?? next.tickHz;
    emit(next);
  } else if (this.latest) {
    const next = structuredClone(this.latest);
    if (command === 'pause' || command === 'resume') next.paused = command === 'pause';
    if (command === 'stepTicks') next.tick += Number(value);
    emit(next);
  }
  return { fixture: true, state: this.latest };
};
BelayConnection.prototype.networkProfile = async () => ({ fixture: true, noNetwork: true });
const fixture = {
  calls: () => calls, input: () => connection?.input,
  counters: () => connection?.viewCounters(),
  showSnapshot(state: Snapshot) { if (connection) { connection.history = []; emit(structuredClone(state)); } },
  seat(id: number) { if (connection) { connection.localId = id; connection.onChange(); } },
  support(value: Support) { if (connection?.latest) { const next = structuredClone(connection.latest); next.players[connection.localId].support = value; next.players[connection.localId].rescueState = value === 'ground' ? 'safe' : value === 'wall' ? 'climbing' : 'hanging'; emit(next); } },
  replace(count: number, scene: SceneOptions['scene'] = 'rescue') { const next = phase2State(count, scene); next.epoch = (connection?.latest?.epoch ?? 0) + 1; emit(next); },
  disconnect() { void connection?.leave(); },
};
Object.assign(window, { BELAY_FIXTURE: fixture, __consoleErrors: [] });
window.addEventListener('error', event => { (window as unknown as { __consoleErrors: string[] }).__consoleErrors.push(event.message); });
const style = document.createElement('style'); style.textContent = '#fixture-banner{height:24px;background:#222;color:#eee;padding:3px 10px;font:11px monospace}.gate{height:calc(100dvh - 24px)}'; document.head.append(style);
createRoot(document.getElementById('root')!).render(<GateClient />);
