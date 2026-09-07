import http from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [mode, output, portOrBehavior, wait = '0', phase] = process.argv.slice(2);
writeFileSync(output, JSON.stringify({ pid: process.pid, hasSecret: Boolean(process.env.BELAY_SESSION_SECRET) }));
if (mode === 'tree') {
  process.on('SIGTERM', () => {});
  const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  writeFileSync(output, JSON.stringify({ pid: process.pid, descendant: child.pid }));
  setInterval(() => {}, 1000);
} else if (mode === 'tunnel') {
  if (portOrBehavior === 'fail') process.exit(42);
  if (portOrBehavior !== 'silent') {
    process.stderr.write('https://test-fixture.trycloud');
    setTimeout(() => {
      process.stderr.write('flare.com\n');
      if (portOrBehavior !== 'unregistered') process.stderr.write('Registered tunnel connection\n');
    }, Number(wait));
  }
  setInterval(() => {}, 1000);
} else if (mode === 'fail') {
  process.exit(42);
} else {
  const server = http.createServer((req, res) => {
    if (mode === 'web') res.end('BELAY Join test rope');
    else if (req.url === '/health') res.end(JSON.stringify({ ok: true, phase: Number(phase) }));
    else if (req.headers['x-belay-gateway'] === process.env.BELAY_SESSION_SECRET) {
      res.end(JSON.stringify({ roomId: 'fixture-room', operator: true, token: 'fixture-token' }));
    } else res.writeHead(401).end();
  });
  setTimeout(() => server.listen(Number(portOrBehavior), '127.0.0.1'), Number(wait));
}
