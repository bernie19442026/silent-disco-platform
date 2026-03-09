// /Users/bernie/silent-disco-platform/apps/web/app/api/admin/channels/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../../lib/auth';
import { getAllChannels, updateChannel } from '../../../../lib/channelStore';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sd_admin_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true, data: getAllChannels() });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { id: number; [key: string]: unknown };
  const { id, ...updates } = body;

  if (!id || typeof id !== 'number') {
    return NextResponse.json({ ok: false, error: 'Missing channel id' }, { status: 400 });
  }

  const updated = updateChannel(id, updates as Parameters<typeof updateChannel>[1]);
  if (!updated) return NextResponse.json({ ok: false, error: 'Channel not found' }, { status: 404 });

  return NextResponse.json({ ok: true, data: updated });
}
