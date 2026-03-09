// /Users/bernie/silent-disco-platform/apps/web/app/api/admin/metrics/route.ts
import { NextResponse } from 'next/server';
import { getAllChannels, getListenerCounts, getAnalyticsEvents } from '../../../../lib/channelStore';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');

  const channels = getAllChannels();
  const counts = getListenerCounts();
  const events = getAnalyticsEvents();
  const totalListeners = Object.values(counts).reduce((a, b) => a + b, 0);

  // Prometheus format
  if (format === 'prometheus') {
    const lines = [
      '# HELP sd_listeners_total Total active listeners',
      '# TYPE sd_listeners_total gauge',
      `sd_listeners_total ${totalListeners}`,
      '',
      '# HELP sd_channel_listeners Listeners per channel',
      '# TYPE sd_channel_listeners gauge',
      ...channels.map((ch) => `sd_channel_listeners{channel="${ch.slug}",name="${ch.name}"} ${counts[ch.id] ?? 0}`),
      '',
      '# HELP sd_analytics_events_total Total analytics events recorded',
      '# TYPE sd_analytics_events_total counter',
      `sd_analytics_events_total ${events.length}`,
      '',
      '# HELP sd_channel_status Channel status (1=live, 0=offline)',
      '# TYPE sd_channel_status gauge',
      ...channels.map((ch) => `sd_channel_status{channel="${ch.slug}"} ${ch.status === 'live' ? 1 : 0}`),
    ];
    return new Response(lines.join('\n'), {
      headers: { 'Content-Type': 'text/plain; version=0.0.4' },
    });
  }

  // JSON format
  return NextResponse.json({
    ok: true,
    data: {
      totalListeners,
      channelCounts: counts,
      channels: channels.map((ch) => ({
        id: ch.id,
        slug: ch.slug,
        name: ch.name,
        status: ch.status,
        listeners: counts[ch.id] ?? 0,
      })),
      analyticsEventsCount: events.length,
      uptime: process.uptime(),
    },
  });
}
