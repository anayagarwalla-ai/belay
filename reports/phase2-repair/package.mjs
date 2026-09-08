import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';

// Preserve finalized evidence byte-for-byte; never package an active journal.
const [sourceArgument, destinationArgument] = process.argv.slice(2);
assert(sourceArgument && destinationArgument && process.argv.length === 4,
  'Usage: node reports/phase2-repair/package.mjs FINAL_DIRECTORY NEW_PACKAGE_DIRECTORY');
const source = path.resolve(sourceArgument), destination = path.resolve(destinationArgument);
const result = JSON.parse(fs.readFileSync(path.join(source, 'result.json'), 'utf8'));
assert.equal(result.evidenceStatus, 'COMPLETE');
assert.equal(result.records.length, 1000);
assert.equal(result.parallel.teardown.length, 4);
assert(result.parallel.teardown.every(r => r.code === 0));
assert(!fs.existsSync(destination), 'Destination must not exist');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = {
  schema: 'belay-phase2-repair-lossless-package-1', invocation: path.basename(source),
  createdAt: new Date().toISOString(),
  sourceManifestSha256: result.sourceManifestSha256,
  scheduleSha256: result.parallel.scheduleSha256,
  encodingRule: 'Deterministic per-file gzip for frozen sources and files at least 65,536 bytes; identity otherwise. Original bytes and POSIX modes retained.',
  files: [], directories: [], totals: { originalBytes: 0, storedBytes: 0 },
};
const originalFiles = [];
function inventory(relative = '') {
  for (const name of fs.readdirSync(path.join(source, relative)).sort()) {
    const file = path.join(relative, name), stat = fs.lstatSync(path.join(source, file));
    assert(!stat.isSymbolicLink(), `Symlink refused: ${file}`);
    const mode = (stat.mode & 0o777).toString(8).padStart(3, '0');
    if (stat.isDirectory()) { manifest.directories.push({ path: file, mode }); inventory(file); }
    else { assert(stat.isFile(), `Non-file refused: ${file}`); originalFiles.push({ path: file, mode, bytes: stat.size }); }
  }
}
inventory();
fs.mkdirSync(destination);
for (const entry of originalFiles) {
  const original = fs.readFileSync(path.join(source, entry.path));
  assert.equal(original.length, entry.bytes);
  assert(original.length <= 33554432, 'File exceeds bounded decoder');
  const compressed = original.length >= 65536 || entry.path.startsWith('source/');
  const stored = compressed ? zlib.gzipSync(original, { level: 9 }) : original;
  const storagePath = path.join('payload', entry.path + (compressed ? '.gz' : ''));
  fs.mkdirSync(path.dirname(path.join(destination, storagePath)), { recursive: true });
  fs.writeFileSync(path.join(destination, storagePath), stored, { flag: 'wx' });
  manifest.files.push({ ...entry, sha256: sha(original), storagePath, encoding: compressed ? 'gzip' : 'identity', storedBytes: stored.length, storedSha256: sha(stored) });
  manifest.totals.originalBytes += original.length;
  manifest.totals.storedBytes += stored.length;
}
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
// Reuse the independently checked historical decoder with this package's exact
// schema and inventory count. The original package and decoder remain untouched.
const historicalDecoder = fs.readFileSync(new URL('../phase2-evidence-package/restore.mjs', import.meta.url), 'utf8');
assert(historicalDecoder.includes("manifest.schema !== 'belay-phase2-lossless-package-1' || manifest.files.length !== 71"));
const decoder = historicalDecoder.replace("manifest.schema !== 'belay-phase2-lossless-package-1' || manifest.files.length !== 71",
  `manifest.schema !== '${manifest.schema}' || manifest.files.length !== ${manifest.files.length}`);
fs.writeFileSync(path.join(destination, 'restore.mjs'), decoder, { flag: 'wx' });
// Check all source bytes again after encoding to catch an unexpectedly changing
// finalized file. Failed packaging remains visibly incomplete, never launch proof.
for (const entry of manifest.files) assert.equal(sha(fs.readFileSync(path.join(source, entry.path))), entry.sha256);
console.log(JSON.stringify({ package: destination, files: manifest.files.length, ...manifest.totals,
  manifestSha256: sha(fs.readFileSync(path.join(destination, 'manifest.json'))) }, null, 2));
