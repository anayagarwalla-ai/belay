import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { availableParallelism } from 'node:os';

const directory = 'reports/phase2-tailwind-build-validation';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fingerprint = () => git('ls-files', '-z').split('\0').filter(path => path &&
  /^(app\/|client\/|components\/|lib\/|shared\/|server\/|public\/|\.openai\/hosting\.json$|(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|tuning\.ts|.*config\.(?:ts|js|json)))$|^(?:app|client|components|lib|shared|server|public)\//.test(path))
  .sort().map(path => ({ path, sha256: sha256(readFileSync(path)) }));
mkdirSync(directory, { recursive: true });
const receipt = {
  command: 'npm run build', cwd: process.cwd(), sourceCommit: git('rev-parse', 'HEAD'),
  sourceTree: git('rev-parse', 'HEAD^{tree}'), trackedStatusBefore: git('status', '--porcelain', '--untracked-files=no'),
  runtime: process.version, platform: process.platform, architecture: process.arch,
  availableParallelism: availableParallelism(),
  environmentOverrides: { RAYON_NUM_THREADS: '1', NODE_OPTIONS: '--max-old-space-size=1536' },
  maximumDurationMs: 180000, minimumAvailableMemoryBytes: 1610612736,
  sharedHost: 'Four evidence workers continue unchanged. Build duration is not an isolated performance measurement.',
  sourceFilesBefore: fingerprint(), start: new Date().toISOString(),
  availableMemoryBefore: process.availableMemory(), abortReason: null,
};
if (receipt.trackedStatusBefore) throw new Error('Tracked source is not clean');
if (receipt.availableMemoryBefore < receipt.minimumAvailableMemoryBytes) throw new Error('Insufficient memory for the authorized build');
const fd = openSync(`${directory}/build.log`, 'wx');
const child = spawn('npm', ['run', 'build'], { detached: true, stdio: ['ignore', fd, fd],
  env: { ...process.env, ...receipt.environmentOverrides } });
receipt.pid = child.pid;
const kill = signal => { try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
let forced;
const abort = reason => { if (receipt.abortReason) return; receipt.abortReason = reason; kill('SIGTERM'); forced = setTimeout(() => kill('SIGKILL'), 3000); };
const memories = [];
const memory = setInterval(() => {
  const bytes = process.availableMemory(); memories.push(bytes);
  if (bytes < receipt.minimumAvailableMemoryBytes) abort('Available memory fell below 1.5 GiB');
}, 1000);
const deadline = setTimeout(() => abort('180-second build bound exceeded'), receipt.maximumDurationMs);
const result = await new Promise(resolve => {
  child.once('error', error => resolve({ code: null, signal: null, error: String(error) }));
  child.once('exit', (code, signal) => resolve({ code, signal }));
});
clearInterval(memory); clearTimeout(deadline); clearTimeout(forced);
kill('SIGTERM');
await new Promise(resolve => setTimeout(resolve, 250));
kill('SIGKILL');
closeSync(fd);
Object.assign(receipt, { ...result, end: new Date().toISOString(),
  minimumObservedAvailableMemoryBytes: Math.min(receipt.availableMemoryBefore, ...memories),
  availableMemoryAfter: process.availableMemory(), sourceFilesAfter: fingerprint(),
  trackedStatusAfter: git('status', '--porcelain', '--untracked-files=no'),
  sourceCommitAfter: git('rev-parse', 'HEAD'), buildLogSha256: sha256(readFileSync(`${directory}/build.log`)),
  teardown: 'Owned build process group received SIGTERM then SIGKILL after npm exited; no development or browser session was started.',
});
receipt.sourceFilesUnchanged = JSON.stringify(receipt.sourceFilesBefore) === JSON.stringify(receipt.sourceFilesAfter);
writeFileSync(`${directory}/build-receipt.json`, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...receipt, sourceFilesBefore: receipt.sourceFilesBefore.length, sourceFilesAfter: receipt.sourceFilesAfter.length }, null, 2));
if (result.code !== 0 || receipt.abortReason || !receipt.sourceFilesUnchanged || receipt.trackedStatusAfter || receipt.sourceCommit !== receipt.sourceCommitAfter) process.exitCode = 1;
