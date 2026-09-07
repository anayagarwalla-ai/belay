import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const { pid } = JSON.parse(await readFile('work/playtest-session.json', 'utf8')) as { pid: number };
const command = execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
if (!command.includes('scripts/playtest.ts')) throw new Error('PID is not the BELAY playtest process; refusing to signal it.');
process.kill(pid, 'SIGTERM');
console.log('Teardown requested for the BELAY remote session.');
