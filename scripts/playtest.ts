import { readFile, writeFile, rm, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createGateway } from '../server/gateway';
import { issueAccess } from '../server/auth';
import { TUNING } from '../tuning';

const local = JSON.parse(await readFile('work/dev-session.json', 'utf8')) as { secret: string };
process.env.BELAY_SESSION_SECRET = local.secret;
await access('.tools/cloudflared');
const invitationKey = randomBytes(TUNING.server.tokenBytes).toString('hex');
const gateway = createGateway(true, invitationKey);
await new Promise<void>((resolve, reject) => { gateway.server.once('error', reject); gateway.server.listen(TUNING.server.protectedPort, TUNING.server.host, resolve); });
const cloudflared = spawn('.tools/cloudflared', ['tunnel', '--config', '/dev/null', '--no-autoupdate', '--url', `http://${TUNING.server.host}:${TUNING.server.protectedPort}`], { stdio: ['ignore', 'pipe', 'pipe'] });
let stopping = false, published = false;
const openedAt = new Date().toISOString();
await writeFile('work/playtest-session.json', JSON.stringify({ pid: process.pid, tunnelPid: cloudflared.pid, openedAt }), { mode: 0o600 });
async function close(code = 0) {
  if (stopping) return; stopping = true; clearTimeout(expiry);
  cloudflared.kill('SIGTERM'); await gateway.close();
  await rm('work/playtest-links.json', { force: true }); await rm('work/playtest-session.json', { force: true });
  await writeFile('work/last-playtest-teardown.json', JSON.stringify({ openedAt, closedAt: new Date().toISOString(), invitationKeyDiscarded: true, cost: 0 }));
  console.log('Remote test closed. Tunnel stopped, gateway closed, invitations invalidated. Cost: $0.');
  process.exit(code);
}
const expiry = setTimeout(() => void close(), TUNING.server.sessionLifetimeSeconds * 1000);
process.on('SIGINT', () => void close()); process.on('SIGTERM', () => void close());
cloudflared.on('error', error => { console.error(error.message); void close(1); });
cloudflared.on('exit', code => { if (!stopping) void close(code || 1); });
const output = (chunk: Buffer) => {
  const text = chunk.toString();
  const url = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (!url || published) return; published = true;
  const links = { openedAt, expiresInSeconds: TUNING.server.sessionLifetimeSeconds,
    operator: `${url}/#${issueAccess('operator', invitationKey)}`,
    tester: `${url}/#${issueAccess('tester', invitationKey)}` };
  void writeFile('work/playtest-links.json', JSON.stringify(links, null, 2), { mode: 0o600 }).then(() => {
    console.log(`Protected remote endpoint: ${url}`);
    console.log('Private invitations saved in work/playtest-links.json. Share only with your invited partner.');
    console.log('Ctrl+C or npm run playtest:stop ends the session. It also expires automatically after two hours.');
  });
};
cloudflared.stderr.on('data', output); cloudflared.stdout.on('data', output);
