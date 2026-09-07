import { describe, expect, it } from 'vitest';
import { isPrivateDevRequest } from '../server/private-paths';

describe('development file perimeter', () => {
  it('blocks private state through direct, Vite filesystem, raw and encoded paths', () => {
    for (const path of ['/work/dev-session.json', '/work/playtest-links.json?raw', '/WORK/DEV-SESSION.JSON',
      '/%77ork/dev-session.json', '/%2577ork/dev-session.json', '/@fs/Users/test/project/work/dev-session.json?import',
      '/@fs/Users/test/project/%77ork/dev-session.json', '/safe/../work/dev-session.json', '/safe/%2e%2e/work/dev-session.json',
      '/safe%2f..%2fwork/dev-session.json', '/work%5cdev-session.json', '/.git/config', '/.wrangler/logs/today.log',
      '/.env.local', '/.tools/cloudflared', '/__open-in-editor?file=work/dev-session.json', '/__debug', '/file%00.ts', '/bad%zz']) {
      expect(isPrivateDevRequest(path), path).toBe(true);
    }
  });
  it('retains application, framework and public code routes needed by the prototype', () => {
    for (const path of ['/', '/favicon.svg', '/@vite/client', '/@id/__x00__virtual:module', '/__vite_hmr',
      '/game/belay/config', '/game/matchmake/joinById/test', '/test-network', '/client/connection.ts',
      '/@fs/Users/test/project/node_modules/three/build/three.module.js']) expect(isPrivateDevRequest(path), path).toBe(false);
  });
});
