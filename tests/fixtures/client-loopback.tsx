import { createRoot } from 'react-dom/client';
import GateClient from '../../client/GateClient';
import { BelayConnection } from '../../client/connection';
import { installLatencyAudit } from './client-latency-audit';
import '../../app/globals.css';

// Observe the real connection without replacing transport, state, timers or input behavior.
let connection: BelayConnection | undefined;
// oxlint-disable-next-line typescript/unbound-method -- Preserved method is called below with the original receiver.
const join = BelayConnection.prototype.join;
BelayConnection.prototype.join = function () {
  // oxlint-disable-next-line typescript/no-this-alias
  connection = this;
  return join.call(this);
};
Object.assign(window, { BELAY_AUDIT: {
  input: () => connection?.input,
  history: () => connection?.history.map(sample => ({ epoch: sample.state.epoch, tick: sample.state.tick })),
  acceptsMovement: () => connection?.acceptsMovement,
  join: () => connection?.join(), leave: () => connection?.leave(),
}, __consoleErrors: [] });
Object.assign(window, { BELAY_LATENCY: installLatencyAudit(() => connection) });
window.addEventListener('error', event => { (window as unknown as { __consoleErrors: string[] }).__consoleErrors.push(event.message); });
createRoot(document.getElementById('root')!).render(<GateClient />);
