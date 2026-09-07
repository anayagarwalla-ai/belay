import { mkdir, mkdtemp, writeFile, chmod, rename, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TUNING } from '../tuning';
import { LIMITS, failureMessage, isMain, projectRoot, writePrivate } from './operations';
import { sha256, validateTunnel } from './tunnel-installation';

const exec = promisify(execFile);
export async function installTunnel(root = projectRoot) {
  if (process.platform !== 'darwin' || !['arm64', 'x64'].includes(process.arch)) throw new Error('This installer is for the verified macOS test host. No system settings were changed.');
  try { await validateTunnel(root); console.log('Pinned cloudflared installation and binary checksum already verified. No download or tunnel needed.'); return; }
  catch { /* Install or repair only with the pinned official archive. */ }
  const arch = process.arch as 'arm64' | 'x64';
  const asset = `cloudflared-darwin-${arch === 'x64' ? 'amd64' : 'arm64'}.tgz`;
  const url = `https://github.com/cloudflare/cloudflared/releases/download/${TUNING.tools.cloudflaredVersion}/${asset}`;
  const directory = join(root, '.tools');
  await mkdir(directory, { recursive: true });
  const staging = await mkdtemp(join(directory, '.cloudflared-'));
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(LIMITS.downloadTimeoutMs) });
    if (!response.ok || !response.body) throw new Error(`Official binary download failed (${response.status}); the previous binary was not replaced.`);
    const parts: Uint8Array[] = []; let size = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > LIMITS.maximumDownloadBytes) {
        await reader.cancel();
        throw new Error('Official download exceeded the archive size bound; the previous binary was not replaced.');
      }
      parts.push(chunk);
    }
    const data = Buffer.concat(parts);
    if (sha256(data) !== TUNING.tools.cloudflaredSha256[arch]) throw new Error('Checksum mismatch. Binary was not installed.');
    const archive = join(staging, asset); await writeFile(archive, data, { mode: 0o600 });
    const entries = (await exec('tar', ['-tzf', archive], { timeout: LIMITS.probeTimeoutMs })).stdout.trim().split('\n');
    if (entries.length !== 1 || entries[0] !== 'cloudflared') throw new Error('Unexpected archive entries; binary was not installed.');
    await exec('tar', ['-xzf', archive, '-C', staging], { timeout: LIMITS.probeTimeoutMs });
    const binary = join(staging, 'cloudflared');
    await chmod(binary, 0o755);
    const version = (await exec(binary, ['--version'], { timeout: LIMITS.probeTimeoutMs })).stdout;
    if (!version.startsWith(`cloudflared version ${TUNING.tools.cloudflaredVersion} `)) throw new Error('Downloaded binary version did not match the pinned release.');
    const receipt = { version: TUNING.tools.cloudflaredVersion, arch,
      archiveSha256: TUNING.tools.cloudflaredSha256[arch], binarySha256: sha256(await readFile(binary)) };
    // Staging and target are on one filesystem. Running sessions keep their original executable.
    await rename(binary, join(directory, 'cloudflared'));
    await writePrivate(join(directory, 'cloudflared-install.json'), receipt);
    console.log(`Official cloudflared ${TUNING.tools.cloudflaredVersion} checksum verified and installed project-locally.`);
    console.log('No account, card, tunnel, or hosted resource created. Run npm run playtest:preflight.');
  } finally { await rm(staging, { recursive: true, force: true }); }
}

if (isMain(import.meta.url)) {
  try { await installTunnel(); }
  catch (error) { console.error(failureMessage(error)); process.exitCode = 1; }
}
