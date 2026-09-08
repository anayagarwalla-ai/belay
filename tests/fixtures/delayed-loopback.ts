import http from 'node:http';
import type { Duplex } from 'node:stream';
import { DelayedStream, type NetworkProfile } from '../../server/impairment';
import { TUNING } from '../../tuning';

/** Same bounded ordered-stream transform used by the protected gateway, aimed at an owned ephemeral authority. */
export async function delayedLoopback(authorityPort: number, profile: () => NetworkProfile) {
  const sockets = new Set<Duplex>();
  const server = http.createServer((req, res) => {
    const upstream = http.request({ hostname: TUNING.server.host, port: authorityPort, path: req.url, method: req.method,
      headers: { ...req.headers, host: `${TUNING.server.host}:${authorityPort}` } }, response => {
      res.writeHead(response.statusCode ?? 502, response.headers); response.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); }); req.pipe(upstream);
  });
  server.on('upgrade', (req, socket, head) => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => socket.destroy());
    const upstream = http.request({ hostname: TUNING.server.host, port: authorityPort, path: req.url,
      headers: { ...req.headers, host: `${TUNING.server.host}:${authorityPort}` } });
    upstream.on('upgrade', (response, remote, remoteHead) => {
      sockets.add(remote); remote.on('close', () => sockets.delete(remote)); remote.on('error', () => remote.destroy());
      let headers = `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`;
      for (let i = 0; i < response.rawHeaders.length; i += 2) headers += `${response.rawHeaders[i]}: ${response.rawHeaders[i + 1]}\r\n`;
      socket.write(headers + '\r\n'); if (remoteHead.length) socket.write(remoteHead); if (head.length) remote.write(head);
      const sending = new DelayedStream(profile), receiving = new DelayedStream(profile);
      sending.on('error', () => socket.destroy()); receiving.on('error', () => remote.destroy());
      socket.pipe(sending).pipe(remote); remote.pipe(receiving).pipe(socket);
      socket.on('close', () => { sending.destroy(); receiving.destroy(); remote.destroy(); }); remote.on('close', () => socket.destroy());
    });
    upstream.on('response', response => socket.end(`HTTP/1.1 ${response.statusCode} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`));
    upstream.on('error', () => socket.destroy()); upstream.end();
  });
  await new Promise<void>(resolve => server.listen(0, TUNING.server.host, resolve));
  return { port: (server.address() as { port: number }).port, close: async () => {
    for (const socket of sockets) socket.destroy(); server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  } };
}
