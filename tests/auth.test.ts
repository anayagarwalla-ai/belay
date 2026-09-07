import { describe, expect, it, vi } from 'vitest';
import { issueAccess, verifyAccess } from '../server/auth';
import { TUNING } from '../tuning';
describe('temporary test access', () => {
  it('rejects missing, forged, wrong-key, and expired invitations', () => {
    const token = issueAccess('tester', 'test-key');
    expect(verifyAccess(token, 'test-key')?.role).toBe('tester');
    expect(verifyAccess(undefined, 'test-key')).toBeNull();
    expect(verifyAccess(token + 'x', 'test-key')).toBeNull();
    expect(verifyAccess(token, 'new-session-key')).toBeNull();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + (TUNING.server.sessionLifetimeSeconds + 1) * 1000);
    expect(verifyAccess(token, 'test-key')).toBeNull(); clock.mockRestore();
  });
  it('binds the operator privilege into the signature', () => {
    const token = issueAccess('tester', 'test-key');
    const [payload, signature] = token.split('.');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); data.role = 'operator';
    expect(verifyAccess(Buffer.from(JSON.stringify(data)).toString('base64url') + '.' + signature, 'test-key')).toBeNull();
  });
});
