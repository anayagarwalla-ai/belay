import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { runDev } from '../../scripts/dev';
import { runPlaytest } from '../../scripts/playtest';
import { childEnvironment, OwnedProcess } from '../../scripts/operations';

const options = JSON.parse(await readFile(process.argv[2], 'utf8'));
const service = fileURLToPath(new URL('./operations-service.mjs', import.meta.url));
const gateway = () => {
  const server = http.createServer((req, res) => {
    const game = req.url?.startsWith('/game/');
    const upstream = http.request({ host: '127.0.0.1', port: game ? options.ports.authority : options.ports.web,
      path: game ? req.url!.slice('/game'.length) : req.url, headers: { 'x-belay-gateway': process.env.BELAY_SESSION_SECRET ?? '' } }, response => {
      res.writeHead(response.statusCode ?? 502); response.pipe(res);
    });
    upstream.on('error', () => res.writeHead(502).end()); req.pipe(upstream);
  });
  return { server, close: async () => {
    server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
  } };
};
if (options.mode === 'dev') {
  process.exitCode = await runDev({ root: options.root, ports: options.ports, gatewayFactory: gateway,
    startupTimeoutMs: options.timeout ?? 5000,
    commands: {
      authority: [process.execPath, service, 'authority', join(options.root, 'authority.json'), String(options.ports.authority), String(options.delay ?? 0)],
      web: [process.execPath, service, options.webFailure ? 'fail' : 'web', join(options.root, 'web.json'), String(options.ports.web), String(options.delay ?? 0)],
    } });
} else if (options.mode === 'playtest') {
  process.exitCode = await runPlaytest({ root: options.root, protectedPort: options.port,
    gatewayFactory: gateway, startupTimeoutMs: options.timeout ?? 5000, lifetimeMs: options.lifetime ?? 10000,
    tunnelCommand: [process.execPath, service, 'tunnel', join(options.root, 'tunnel.json'), options.behavior ?? 'registered', '30'],
    // No public request is made: these test dependencies return readiness for a synthetic URL.
    verifyPublic: async () => { if (options.verifyDelay) await new Promise(done => setTimeout(done, options.verifyDelay)); return true; },
  });
} else {
  const child = new OwnedProcess([process.execPath, service, 'tree', join(options.root, 'tree.json')], options.root, childEnvironment(), () => {});
  await writeFile(join(options.root, 'parent.json'), JSON.stringify({ pid: process.pid, guardianPid: child.pid }));
  process.on('SIGTERM', () => { void child.stop().then(() => process.exit()); });
}
