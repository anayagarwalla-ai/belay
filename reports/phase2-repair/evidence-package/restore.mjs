import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Offline archive reconstruction only. No simulation, collector or runtime imports.
const base = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 1) throw new Error('Usage: node restore.mjs --verify | NEW_OUTPUT_DIRECTORY');
const verifyOnly = args[0] === '--verify';
const destination = verifyOnly ? null : path.resolve(args[0]);
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
if (manifest.schema !== 'belay-phase2-repair-lossless-package-1' || manifest.files.length !== 77) throw new Error('Unexpected archive manifest');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const safe = name => {
  if (typeof name !== 'string' || path.isAbsolute(name) || name.split(/[\\/]/).some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe relative path');
  return name;
};
const noSymlinks = relative => {
  let here = base;
  for (const part of safe(relative).split('/')) { here = path.join(here, part); if (fs.lstatSync(here).isSymbolicLink()) throw new Error('Archive symlink refused'); }
  return here;
};
const mode = value => { if (!/^[0-7]{3}$/.test(value)) throw new Error('Invalid mode'); return parseInt(value, 8); };
const seen = new Set();
function read(entry) {
  if (entry.bytes < 0 || entry.bytes > 33554432 || entry.storedBytes < 0 || entry.storedBytes > 33554432) throw new Error('Invalid file bounds');
  const file = noSymlinks(entry.storagePath);
  if (fs.statSync(file).size !== entry.storedBytes) throw new Error('Stored length mismatch: ' + entry.path);
  const stored = fs.readFileSync(file);
  if (sha(stored) !== entry.storedSha256) throw new Error('Stored hash mismatch: ' + entry.path);
  const bytes = entry.encoding === 'gzip' ? zlib.gunzipSync(stored, { maxOutputLength: 33554432 }) : entry.encoding === 'identity' ? stored : null;
  if (!bytes || bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) throw new Error('Original bytes mismatch: ' + entry.path);
  return bytes;
}
for (const entry of manifest.files) {
  safe(entry.path); mode(entry.mode);
  if (seen.has(entry.path)) throw new Error('Duplicate original path');
  seen.add(entry.path); read(entry);
}
for (const entry of manifest.directories) { safe(entry.path); mode(entry.mode); }
if (destination) {
  // Refuse an existing destination: never overwrite the original finalized run.
  fs.mkdirSync(destination);
  for (const entry of manifest.files) {
    const file = path.join(destination, entry.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, read(entry), { flag: 'wx', mode: 0o600 });
    fs.chmodSync(file, mode(entry.mode));
  }
  for (const entry of [...manifest.directories].sort((a,b) => b.path.length - a.path.length)) {
    const dir = path.join(destination, entry.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.chmodSync(dir, mode(entry.mode));
  }
  for (const entry of manifest.files) {
    const file = path.join(destination, entry.path);
    if (sha(fs.readFileSync(file)) !== entry.sha256 || (fs.statSync(file).mode & 0o777) !== mode(entry.mode)) throw new Error('Reconstruction mismatch');
  }
  for (const entry of manifest.directories) if ((fs.statSync(path.join(destination, entry.path)).mode & 0o777) !== mode(entry.mode)) throw new Error('Directory mode mismatch');
}
console.log(JSON.stringify({ status: destination ? 'RECONSTRUCTED_BYTES_AND_MODES' : 'VERIFIED_PACKAGED_BYTES', destination,
  files: manifest.files.length, directories: manifest.directories.length, ...manifest.totals,
  manifestSha256: sha(fs.readFileSync(path.join(base, 'manifest.json'))),
  scope: 'Archive byte and POSIX-mode integrity only; no physics, gameplay, runtime or original-host validation.' }, null, 2));
