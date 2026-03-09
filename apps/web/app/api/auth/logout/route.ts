// /Users/bernie/silent-disco-platform/apps/web/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('sd_admin_token');
  return response;
}
