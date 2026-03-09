/**
 * @jest-environment node
 */
import { verifyCredentials, signToken, verifyToken, hashPassword } from '../lib/auth';

describe('Auth', () => {
  test('verifyCredentials: valid admin/password', async () => {
    const result = await verifyCredentials('admin', 'password');
    expect(result).toBe(true);
  });

  test('verifyCredentials: wrong password', async () => {
    const result = await verifyCredentials('admin', 'wrongpassword');
    expect(result).toBe(false);
  });

  test('verifyCredentials: wrong username', async () => {
    const result = await verifyCredentials('notadmin', 'password');
    expect(result).toBe(false);
  });

  test('signToken and verifyToken round-trip', async () => {
    const token = await signToken({ sub: 'admin', role: 'admin' });
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);

    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('admin');
    expect(payload?.role).toBe('admin');
  });

  test('verifyToken: invalid token returns null', async () => {
    const payload = await verifyToken('invalid.token.here');
    expect(payload).toBeNull();
  });

  test('verifyToken: tampered token returns null', async () => {
    const token = await signToken({ sub: 'admin', role: 'admin' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    const payload = await verifyToken(tampered);
    expect(payload).toBeNull();
  });

  test('hashPassword produces bcrypt hash', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
  });
});
