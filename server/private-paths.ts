/** The dev frontend must never serve session credentials, logs, Git internals,
 * or local tool state, including Vite /@fs and encoded path variants. */
export const PRIVATE_FILE_GLOBS = ['**/work/**', '**/.tools/**', '**/.git/**', '**/.wrangler/**',
  '**/.env*', '**/*.{crt,pem,key}', '**/.npmrc', '**/.netrc'];
const privateSegments = new Set(['work', '.tools', '.git', '.wrangler', '.npmrc', '.netrc',
  '__debug', '__open-in-editor', '__inspect']);
export function isPrivateDevRequest(url: string) {
  if (!url.startsWith('/') || url.startsWith('//')) return true;
  let decoded = url;
  // Every pass shortens a percent-encoded path, so this terminates without an arbitrary depth limit.
  while (true) {
    const path = decoded.split(/[?#]/)[0].replaceAll('\\', '/');
    if (path.includes('\0')) return true;
    if (path.toLowerCase().split('/').some(segment => privateSegments.has(segment)
      || segment.startsWith('.env') || /\.(pem|crt|key)$/.test(segment))) return true;
    let next: string;
    try { next = decodeURIComponent(decoded); } catch { return true; }
    if (next === decoded) return false;
    decoded = next;
  }
}
