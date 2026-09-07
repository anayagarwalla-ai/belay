import { readFile } from 'node:fs/promises';
import { Client, type Room } from '@colyseus/sdk';
import { TUNING } from '../tuning';
import type { ClientConfig, Snapshot, DebugCommand } from '../shared/protocol';

export async function localClient() {
  const session = JSON.parse(await readFile('work/dev-session.json', 'utf8')) as { secret: string };
  const response = await fetch(`http://${TUNING.server.host}:${TUNING.server.port}/belay/config`,
    { headers: { 'x-belay-gateway': session.secret, 'x-belay-role': 'operator' } });
  if (!response.ok) throw new Error('Start npm run dev first.');
  const config = await response.json() as ClientConfig;
  return { config, client: new Client(`ws://${TUNING.server.host}:${TUNING.server.port}`) };
}
export function observe(room: Room) {
  let latest: Snapshot | undefined;
  let localId = -1;
  room.onMessage('snapshot', (state: Snapshot) => { latest = state; });
  room.onMessage('seat', ({ id }: { id: number }) => { localId = id; });
  room.onMessage('identity', ({ id }: { id: number }) => { localId = id; });
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  room.onMessage('debugResult', ({ requestId, result, error }: { requestId: string; result: unknown; error?: string }) => {
    const task = pending.get(requestId); if (!task) return;
    clearTimeout(task.timer); pending.delete(requestId);
    if (error) task.reject(new Error(error)); else task.resolve(result);
  });
  room.send('identify');
  return {
    get latest() { return latest; }, get localId() { return localId; },
    command(command: DebugCommand['command'], value?: unknown) {
      const requestId = crypto.randomUUID();
      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`${command} timed out`)); }, TUNING.network.debugTimeoutMs);
        pending.set(requestId, { resolve, reject, timer }); room.send('debug', { requestId, command, value });
      });
    },
  };
}
export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
