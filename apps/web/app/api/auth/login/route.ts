// /Users/bernie/silent-disco-platform/apps/web/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { verifyCredentials, signToken } from '../../../../lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { username?: string; password?: string };
    const { username = '', password = '' } = body;

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: 'Missing credentials' }, { status: 400 });
    }

    const valid = await verifyCredentials(username, password);
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({ sub: username, role: 'admin' });

    const response = NextResponse.json({ ok: true, token });
    response.cookies.set('sd_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
