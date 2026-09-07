import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const server = await createServer({ root, configFile: false, plugins: [react()], resolve: { alias: { '@': root } },
  css: { postcss: { plugins: [tailwindcss()] } }, server: { host: '127.0.0.1', port: 0, strictPort: true,
    fs: { deny: ['**/.env*', '**/.git/**', '**/work/**', '**/.tools/**'] } } });
await server.listen();
const address = server.httpServer!.address() as { port: number };
console.log(`Isolated client fixture: http://127.0.0.1:${address.port}/tests/fixtures/client-preview.html`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void server.close().then(() => process.exit()); });
