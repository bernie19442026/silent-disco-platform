// /Users/bernie/silent-disco-platform/apps/web/app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../lib/auth';
import { updateChannel } from '../../../lib/channelStore';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/webm'];
const MAX_SIZE = 500 * 1024 * 1024; // 500MB

export async function POST(req: Request) {
  // Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get('sd_admin_token')?.value;
  if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const admin = await verifyToken(token);
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const channelIdStr = formData.get('channelId') as string | null;

    if (!file) return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    if (!channelIdStr) return NextResponse.json({ ok: false, error: 'No channelId provided' }, { status: 400 });

    const channelId = parseInt(channelIdStr, 10);
    if (isNaN(channelId)) return NextResponse.json({ ok: false, error: 'Invalid channelId' }, { status: 400 });

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ ok: false, error: `Invalid file type: ${file.type}` }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: 'File too large (max 500MB)' }, { status: 400 });
    }

    // Sanitize filename
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'audio';
    const safeFilename = `${randomUUID()}.${ext}`;

    // Save to public/uploads/
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, safeFilename);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Update channel to use this file
    const publicUrl = `/uploads/${safeFilename}`;
    updateChannel(channelId, {
      sourceType: 'file',
      sourceUrl: publicUrl,
      uploadedFile: safeFilename,
    });

    return NextResponse.json({
      ok: true,
      data: { filename: safeFilename, url: publicUrl, size: file.size },
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ ok: false, error: 'Upload failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
