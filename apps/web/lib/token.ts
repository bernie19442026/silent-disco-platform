/**
 * Edge-compatible JWT verification — no Node.js-only deps.
 * Used exclusively by middleware.ts (Edge Runtime).
 * Full auth (bcrypt + jose) lives in lib/auth.ts for Node routes.
 */
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'silent-disco-dev-secret-change-in-production'
);

export async function verifyTokenEdge(token: string): Promise<{ sub: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { sub: string; role: string };
  } catch {
    return null;
  }
}
