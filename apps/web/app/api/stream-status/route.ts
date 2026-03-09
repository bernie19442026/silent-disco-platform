/**
 * Server-Sent Events endpoint for real-time stream health & listener counts.
 * Compatible with Vercel's streaming runtime.
 */

import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const SLUGS = ['channel1', 'channel2', 'channel3', 'channel4'];
const CHANNEL_IDS = [1, 2, 3, 4];
const POLL_INTERVAL_MS = 5_000;

interface IcecastSource {
  listenurl?: string;
  listeners?: number;
}

async function fetchIcecastStats(): Promise<IcecastSource[]> {
  const icecastUrl = process.env.ICECAST_STATS_URL;
  if (!icecastUrl) return [];

  try {
    const res = await fetch(`${icecastUrl}/status-json.xsl`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return [];
    const json = await res.json() as { icestats?: { source?: IcecastSource[] } };
    const raw = json.icestats?.source ?? [];
    return Array.isArray(raw) ? raw : [raw];
  } catch {
    return [];
  }
}

function buildStatusPayload(sources: IcecastSource[]) {
  const channels = SLUGS.map((slug, idx) => {
    const source = sources.find((s) => s.listenurl?.includes(slug));
    return {
      id: CHANNEL_IDS[idx],
      slug,
      status: source ? 'live' : 'offline',
      listenerCount: source?.listeners ?? 0,
    };
  });

  return {
    type: 'health',
    channels,
    timestamp: new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const encode = (data: unknown) =>
        new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

      // Send initial ping
      controller.enqueue(encode({ type: 'ping' }));

      // Poll Icecast and push updates
      const interval = setInterval(async () => {
        try {
          const sources = await fetchIcecastStats();
          const payload = buildStatusPayload(sources);
          controller.enqueue(encode(payload));
        } catch {
          controller.enqueue(encode({ type: 'ping' }));
        }
      }, POLL_INTERVAL_MS);

      // Cleanup when client disconnects (Edge Runtime handles this)
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
