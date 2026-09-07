import { spawn } from 'node:child_process';
import { TUNING } from '../tuning';

// Launched only as a detached IPC guardian by OwnedProcess. Never adopt an external PID.
if (!process.send || process.platform === 'win32') throw new Error('BELAY process guardian requires a POSIX IPC parent.');
// The parent can die while tsx is loading, before a disconnect listener exists.
if (!process.connected) process.exit(1);
let stopping = false;
const killGroup = (signal: NodeJS.Signals) => { try { process.kill(-process.pid, signal); } catch { process.exit(1); } };
const stop = () => {
  if (stopping) return;
  stopping = true;
  setTimeout(() => killGroup('SIGKILL'), TUNING.tools.operations.shutdownGraceMs);
  killGroup('SIGTERM');
};
process.on('SIGINT', stop); process.on('SIGTERM', stop);
process.on('disconnect', stop); process.on('message', stop);
const child = spawn(process.argv[2], process.argv.slice(3), { stdio: 'inherit', env: process.env });
const finished = (code: number) => {
  // Kill any grandchildren still in our group, even if the immediate child exited first.
  if (process.connected) process.send!({ code }, () => killGroup('SIGKILL'));
  else killGroup('SIGKILL');
};
child.once('error', () => finished(1));
child.once('exit', code => finished(code ?? 1));
