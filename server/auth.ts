import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { TUNING } from '../tuning';

export type Access = { role: 'operator' | 'tester'; expires: number; nonce: string };
export function secret() {
  const value = process.env.BELAY_SESSION_SECRET;
  if (!value) throw new Error('Start using npm run dev; a session secret is required.');
  return value;
}
export function sameSecret(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function issueAccess(role: Access['role'], key = secret()): string {
  const data: Access = { role, expires: Math.floor(Date.now() / 1000) + TUNING.server.sessionLifetimeSeconds,
    nonce: randomBytes(TUNING.server.tokenBytes).toString('hex') };
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  return payload + '.' + createHmac('sha256', key).update(payload).digest('base64url');
}
export function verifyAccess(token: unknown, key = secret()): Access | null {
  if (typeof token !== 'string' || token.length > TUNING.server.maximumAuthBodyBytes) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  if (!sameSecret(signature, createHmac('sha256', key).update(payload).digest('base64url'))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Access;
    return ['operator', 'tester'].includes(data.role) && Number.isFinite(data.expires)
      && data.expires > Date.now() / 1000 && typeof data.nonce === 'string' ? data : null;
  } catch { return null; }
}
