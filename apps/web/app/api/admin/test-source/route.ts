/**
 * POST /api/admin/test-source
 *
 * Probes a stream URL from the server side and returns latency + HTTP status.
 * Used by the admin dashboard's "Test Connection" button.
 *
 * Body: { url: string; type: 'icecast' | 'hls' | 'external' | 'file' }
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '../../../../lib/auth';

interface TestSourceBody {
  url: string;
  type: 'icecast' | 'hls' | 'external' | 'file' | 'webrtc';
}

interface TestResult {
  reachable: boolean;
  latencyMs: number | null;
  httpStatus: number | null;
  contentType: string | null;
  error: string | null;
}

export async function POST(req: Request): Promise<NextResponse> {
  // Auth guard (middleware already covers /api/admin/*, but double-check)
  const cookieStore = await cookies();
  const token = cookieStore.get('sd_admin_token')?.value;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as TestSourceBody;
  const { url, type } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ ok: false, error: 'url is required' }, { status: 400 });
  }

  // File uploads are always local — no network probe needed
  if (type === 'file') {
    const isPublicPath = url.startsWith('/uploads/');
    return NextResponse.json<{ ok: true; data: TestResult }>({
      ok: true,
      data: {
        reachable: isPublicPath,
        latencyMs: 0,
        httpStatus: isPublicPath ? 200 : null,
        contentType: 'audio/*',
        error: isPublicPath ? null : 'File path must start with /uploads/',
      },
    });
  }

  // WebRTC — can only be validated by format, not fetched from server
  if (type === 'webrtc') {
    const isWs = url.startsWith('ws://') || url.startsWith('wss://');
    return NextResponse.json<{ ok: true; data: TestResult }>({
      ok: true,
      data: {
        reachable: isWs,
        latencyMs: null,
        httpStatus: null,
        contentType: null,
        error: isWs ? null : 'WebRTC signaling URL must start with ws:// or wss://',
      },
    });
  }

  // HTTP/HTTPS probe — HEAD request with a 5 s timeout
  const result: TestResult = {
    reachable: false,
    latencyMs: null,
    httpStatus: null,
    contentType: null,
    error: null,
  };

  try {
    // Validate URL before fetching
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json<{ ok: true; data: TestResult }>({
        ok: true,
        data: { ...result, error: 'Only http:// and https:// URLs can be probed' },
      });
    }

    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SignalDisco-HealthProbe/1.0',
        // Icecast needs an Icy-MetaData header to respond properly
        'Icy-MetaData': '0',
      },
      redirect: 'follow',
    });

    clearTimeout(timer);
    result.latencyMs = Date.now() - start;
    result.httpStatus = response.status;
    result.contentType = response.headers.get('content-type');
    // 200-299 and common stream codes (200, 206) are "reachable"
    result.reachable = response.status >= 200 && response.status < 400;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('aborted') || msg.includes('abort')) {
      result.error = 'Connection timed out (>5 s)';
    } else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      result.error = 'DNS resolution failed — host not found';
    } else if (msg.includes('ECONNREFUSED')) {
      result.error = 'Connection refused — server may be offline';
    } else {
      result.error = msg;
    }
  }

  return NextResponse.json<{ ok: true; data: TestResult }>({ ok: true, data: result });
}
