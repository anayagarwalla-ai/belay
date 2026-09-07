import http, { type IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { TUNING } from '../tuning';
import { secret, verifyAccess } from './auth';
import { DelayedStream, parseNetworkProfile, type NetworkProfile } from './impairment';
import { isPrivateDevRequest } from './private-paths';

const loginPage = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BELAY — invited test</title>
<style>body{font:16px monospace;max-width:36rem;margin:12vh auto;padding:24px;background:#ddd;color:#222}input,button{font:inherit;padding:12px;margin:8px 0;width:100%;box-sizing:border-box}p{line-height:1.6}</style>
<h1>BELAY</h1><p>This is an invited, temporary rope test.</p><form><label for="ticket">Session invitation</label><input id="ticket" type="password" autocomplete="off" required><button>Enter test</button></form><p id="status" role="status"></p>
<script>const field=document.querySelector('input');const fragment=location.hash.slice(1);if(fragment){field.value=decodeURIComponent(fragment);history.replaceState(null,'','/');}
document.querySelector('form').onsubmit=async e=>{e.preventDefault();const r=await fetch('/access',{method:'POST',headers:{'Content-Type':'text/plain'},body:field.value});if(r.ok)location.replace('/');else document.querySelector('#status').textContent='Invitation expired or invalid.'};if(field.value)document.querySelector('form').requestSubmit();</script></html>`;

/** Test-only gateway. No internet-facing simulation or production infrastructure is provisioned. */
export function createGateway(protectedMode = false, invitationKey = secret()) {
  let profile: NetworkProfile = { addedRttMs: 0, jitterMs: 0 };
  const connections = new Set<Duplex>();
  const attempts = new Map<string, { start: number; count: number }>();
  const access = (req: IncomingMessage) => {
    if (!protectedMode) return { role: 'operator' as const };
    const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('belay_test='))?.slice('belay_test='.length);
    return verifyAccess(cookie, invitationKey);
  };
  const target = (url = '/') => url.startsWith('/game/')
    ? { port: TUNING.server.port, path: url.slice('/game'.length) }
    : { port: TUNING.server.webPort, path: url };
  const forwarded = (req: IncomingMessage, role: string, port: number) => {
    const headers = { ...req.headers };
    delete headers['x-belay-gateway']; delete headers['x-belay-role'];
    delete headers['x-forwarded-host']; delete headers['x-forwarded-for'];
    headers['x-belay-gateway'] = secret(); headers['x-belay-role'] = role;
    headers.host = `${TUNING.server.host}:${port}`;
    return headers;
  };
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (protectedMode && req.url === '/access' && req.method === 'POST') {
      const now = Date.now(), ip = req.socket.remoteAddress ?? 'unknown';
      for (const [key, value] of attempts) if (now - value.start > 60000) attempts.delete(key);
      const attempt = attempts.get(ip) ?? { start: now, count: 0 };
      attempts.set(ip, attempt);
      if (++attempt.count > TUNING.server.authAttemptsPerMinute) { res.writeHead(429).end('Try again later.'); return; }
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); if (Buffer.byteLength(body) > TUNING.server.maximumAuthBodyBytes) req.destroy(); });
      req.on('end', () => {
        if (!verifyAccess(body, invitationKey)) { res.writeHead(401).end('Invalid invitation.'); return; }
        const secure = req.headers.host?.endsWith('.trycloudflare.com');
        res.setHeader('Set-Cookie', `belay_test=${body}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TUNING.server.sessionLifetimeSeconds}${secure ? '; Secure' : ''}`);
        res.writeHead(204).end();
      });
      return;
    }
    const identity = access(req);
    if (!identity) {
      if (req.url === '/' && req.method === 'GET') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(loginPage); }
      else res.writeHead(401).end('A session invitation is required.');
      return;
    }
    if (isPrivateDevRequest(req.url ?? '/')) { res.writeHead(403).end('Private development files are unavailable.'); return; }
    if (req.url === '/test-network') {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET') { res.end(JSON.stringify({ ...profile, kind: 'Added ordered-stream delay; not total RTT or packet loss.' })); return; }
      if (req.method !== 'POST' || identity.role !== 'operator') { res.writeHead(403).end('{}'); return; }
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); if (body.length > TUNING.server.maximumAuthBodyBytes) req.destroy(); });
      req.on('end', () => {
        try { profile = parseNetworkProfile(JSON.parse(body)); res.end(JSON.stringify(profile)); }
        catch { res.writeHead(400).end(JSON.stringify({ error: 'Invalid added RTT/jitter profile.' })); }
      });
      return;
    }
    const destination = target(req.url);
    const upstream = http.request({ hostname: TUNING.server.host, ...destination, method: req.method,
      headers: forwarded(req, identity.role, destination.port), timeout: TUNING.server.httpTimeoutMs }, response => {
      res.writeHead(response.statusCode ?? 502, { ...response.headers, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
      response.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('The local test server is unavailable.'); });
    upstream.on('timeout', () => upstream.destroy());
    req.pipe(upstream);
  });
  server.on('upgrade', (req, socket, head) => {
    const identity = access(req);
    if (!identity) { socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return; }
    if (isPrivateDevRequest(req.url ?? '/')) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return; }
    connections.add(socket); socket.on('close', () => connections.delete(socket)); socket.on('error', () => socket.destroy());
    const destination = target(req.url);
    const upstream = http.request({ hostname: TUNING.server.host, ...destination,
      headers: forwarded(req, identity.role, destination.port) });
    upstream.on('upgrade', (response, remote, remoteHead) => {
      connections.add(remote); remote.on('close', () => connections.delete(remote)); remote.on('error', () => remote.destroy());
      let headers = `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`;
      for (let i = 0; i < response.rawHeaders.length; i += 2) headers += `${response.rawHeaders[i]}: ${response.rawHeaders[i + 1]}\r\n`;
      socket.write(headers + '\r\n');
      if (remoteHead.length) socket.write(remoteHead);
      if (head.length) remote.write(head);
      const sending = new DelayedStream(() => profile), receiving = new DelayedStream(() => profile);
      sending.on('error', () => socket.destroy()); receiving.on('error', () => remote.destroy());
      socket.pipe(sending).pipe(remote); remote.pipe(receiving).pipe(socket);
      socket.on('close', () => { sending.destroy(); receiving.destroy(); });
      socket.on('close', () => remote.destroy()); remote.on('close', () => socket.destroy());
    });
    upstream.on('response', response => { socket.end(`HTTP/1.1 ${response.statusCode} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); });
    upstream.on('error', () => socket.destroy()); upstream.end();
  });
  return { server, close: async () => {
    for (const connection of connections) connection.destroy();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  } };
}
