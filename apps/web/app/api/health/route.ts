import { NextResponse } from 'next/server';

interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  icecast: 'ok' | 'unreachable';
  channels: Record<string, 'live' | 'offline'>;
  checkedAt: string;
}

export async function GET() {
  const icecastUrl = process.env.ICECAST_STATS_URL ?? 'http://localhost:8000';
  const slugs = ['channel1', 'channel2', 'channel3', 'channel4'];

  let icecastStatus: 'ok' | 'unreachable' = 'unreachable';
  const channelStatuses: Record<string, 'live' | 'offline'> = {};

  try {
    const res = await fetch(`${icecastUrl}/status-json.xsl`, {
      signal: AbortSignal.timeout(4_000),
    });

    if (res.ok) {
      icecastStatus = 'ok';
      const json = await res.json() as {
        icestats?: { source?: Array<{ listenurl?: string }> };
      };
      const sources = json.icestats?.source ?? [];

      for (const slug of slugs) {
        const active = sources.some((s) => s.listenurl?.includes(slug));
        channelStatuses[slug] = active ? 'live' : 'offline';
      }
    }
  } catch {
    for (const slug of slugs) channelStatuses[slug] = 'offline';
  }

  const allLive = Object.values(channelStatuses).every((s) => s === 'live');
  const anyLive = Object.values(channelStatuses).some((s) => s === 'live');

  const report: HealthReport = {
    status: allLive ? 'ok' : anyLive ? 'degraded' : 'down',
    icecast: icecastStatus,
    channels: channelStatuses,
    checkedAt: new Date().toISOString(),
  };

  const httpStatus = report.status === 'down' ? 503 : 200;
  return NextResponse.json(report, { status: httpStatus });
}
