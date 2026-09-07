import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { TUNING } from '../tuning';

if (process.argv.length !== 2) throw new Error('Usage: npm run verify:evidence');
const root = realpathSync('.');
const maximumBytes = TUNING.localLoad.maximumReportBytes;
let checked = 0;
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
function read(name: string) {
  const target = realpathSync(path.resolve(root, name));
  if (!target.startsWith(root + path.sep)) throw new Error('Evidence path leaves the repository.');
  if (statSync(target).size > maximumBytes) throw new Error(`Evidence artifact exceeds the existing local report bound: ${name}`);
  return readFileSync(target);
}
function json<T>(name: string): T { return JSON.parse(read(name).toString('utf8')) as T; }
function verify(name: string, hash: string, size?: number) {
  const data = read(name);
  assert.equal(sha(data), hash, `SHA-256 mismatch: ${name}`);
  if (size !== undefined) assert.equal(data.length, size, `Size mismatch: ${name}`);
  checked++;
}

for (const [file, prefix] of [
  ['reports/local-load-profile-checksums.txt', 'reports/'],
  ['reports/local-load-runtime-checksums.txt', ''],
]) {
  for (const line of read(file).toString('utf8').trim().split('\n')) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert(match, `Malformed checksum line in ${file}`);
    verify(prefix + match[2], match[1]);
  }
}

type Compressed = { path: string; compressedBytes: number; compressedSha256: string; decompressedBytes: number; decompressedSha256: string };
for (const file of ['reports/local-load-profile-compression.json', 'reports/rescue-recut-compression.json']) {
  for (const row of json<{ artifacts: Compressed[] }>(file).artifacts) {
    verify('reports/' + row.path, row.compressedSha256, row.compressedBytes);
    const raw = gunzipSync(read('reports/' + row.path), { maxOutputLength: maximumBytes });
    assert.equal(raw.length, row.decompressedBytes, `Decompressed size mismatch: ${row.path}`);
    assert.equal(sha(raw), row.decompressedSha256, `Decompressed SHA-256 mismatch: ${row.path}`);
    checked++;
  }
}

const recut = json<{ artifacts: Record<string, { sha256: string; bytes: number }> }>('reports/rescue-recut-manifest.json');
for (const [file, value] of Object.entries(recut.artifacts)) verify(file, value.sha256, value.bytes);
const topology = json<{ artifacts: Record<string, string>; candidates: { patchPath: string | null; patchSha256: string | null; resultPath: string; resultSha256: string }[] }>('reports/phase2-topology-manifest.json');
for (const [file, hash] of Object.entries(topology.artifacts)) verify(file, hash);
for (const candidate of topology.candidates) {
  verify(candidate.resultPath, candidate.resultSha256);
  if (candidate.patchPath && candidate.patchSha256) verify(candidate.patchPath, candidate.patchSha256);
}
const bundle = json<{ sha256: string; bytes: number }>('reports/phase2-baseline-bundle.json');
verify('reports/phase2-baseline.bundle', bundle.sha256, bundle.bytes);
execFileSync('git', ['bundle', 'verify', 'reports/phase2-baseline.bundle'], { stdio: 'pipe' });
console.log(JSON.stringify({ checked, result: 'PASS', scope: 'Stored artifact and decompressed-byte integrity, plus baseline bundle validity. Does not pass gameplay, determinism, capacity, or human gates.' }));
