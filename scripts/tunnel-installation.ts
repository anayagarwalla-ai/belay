import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { TUNING } from '../tuning';

export const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
export async function validateTunnel(root: string) {
  if (process.platform !== 'darwin' || !['arm64', 'x64'].includes(process.arch)) throw new Error('The pinned tunnel installer currently supports macOS arm64/x64 only. Local two-browser setup remains available.');
  try {
    const path = join(root, '.tools', 'cloudflared');
    const receipt = JSON.parse(await readFile(join(root, '.tools', 'cloudflared-install.json'), 'utf8'));
    const info = await lstat(path);
    await access(path, constants.X_OK);
    if (!info.isFile() || receipt.version !== TUNING.tools.cloudflaredVersion || receipt.arch !== process.arch
      || receipt.archiveSha256 !== TUNING.tools.cloudflaredSha256[process.arch as 'arm64' | 'x64']
      || receipt.binarySha256 !== sha256(await readFile(path))) throw new Error();
    return path;
  } catch { throw new Error('Tunnel binary is missing, changed, or lacks a verified installation receipt. Run npm run setup:tunnel in this checkout, then rerun preflight.'); }
}
