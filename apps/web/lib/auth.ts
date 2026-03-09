// /Users/bernie/silent-disco-platform/apps/web/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'silent-disco-dev-secret-change-in-production'
);

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? '';
// Default password "password" pre-hashed (for dev only)
const DEFAULT_HASH = '$2b$10$YoJbzVukMP8aUw5pEZi4VOymwp3jlwHe1.2z6SzSI0uaNbMRdTOAy';

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  if (username !== ADMIN_USERNAME) return false;
  const hash = ADMIN_PASSWORD_HASH || DEFAULT_HASH;
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: { sub: string; role: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<{ sub: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { sub: string; role: string };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
