import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createGateway } from '../server/gateway';
import { TUNING } from '../tuning';

process.env.BELAY_SESSION_SECRET = randomBytes(TUNING.server.tokenBytes).toString('hex');
const children: ChildProcess[] = [];
const start = (args: string[]) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env, detached: true });
  children.push(child); return child;
};
const gateway = createGateway();
let closing = false;
async function close(code = 0) {
  if (closing) return; closing = true;
  await gateway.close();
  for (const child of children) if (child.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already stopped */ } }
  await rm('work/dev-session.json', { force: true });
  process.exit(code);
}
process.on('SIGINT', () => void close()); process.on('SIGTERM', () => void close());
await mkdir('work', { recursive: true });
await writeFile('work/dev-session.json', JSON.stringify({ secret: process.env.BELAY_SESSION_SECRET, pid: process.pid }), { mode: 0o600 });
start(['--import', 'tsx', 'server/main.ts']);
start(['node_modules/vinext/dist/cli.js', 'dev', '--host', TUNING.server.host, '--port', String(TUNING.server.webPort)]);
for (const child of children) child.on('exit', code => { if (!closing) void close(code || 1); });
gateway.server.on('error', error => { console.error(error.message); void close(1); });
gateway.server.listen(TUNING.server.gatewayPort, TUNING.server.host, () => {
  console.log(`BELAY local preview: http://${TUNING.server.host}:${TUNING.server.gatewayPort}`);
  console.log('Loopback only. No remote tunnel or paid resources started. Ctrl+C tears down the local session.');
});
