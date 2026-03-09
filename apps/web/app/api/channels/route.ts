import { NextResponse } from 'next/server';
import { buildDefaultEndpoints } from '../../../lib/streaming';
import type { Channel } from '../../../lib/types';
import { getAllChannels, getListenerCounts } from '../../../lib/channelStore';

export async function GET() {
  // Merge admin channelStore config with endpoint data and live listener counts
  const adminChannels = getAllChannels();
  const counts = getListenerCounts();

  const channels: Channel[] = adminChannels.map((ac) => ({
    id: ac.id,
    slug: ac.slug,
    name: ac.name,
    description: ac.description,
    color: ac.color,
    emoji: ac.emoji,
    status: ac.status,
    listenerCount: counts[ac.id] ?? ac.listenerCount,
    endpoints: buildDefaultEndpoints(ac.slug),
  }));

  // Optionally proxy to the streaming server to get live listener counts
  const enriched = await enrichWithLiveCounts(channels);
  return NextResponse.json({ data: enriched, ok: true });
}

async function enrichWithLiveCounts(channels: Channel[]): Promise<Channel[]> {
  const icecastUrl = process.env.ICECAST_STATS_URL;
  if (!icecastUrl) return channels;

  try {
    const res = await fetch(`${icecastUrl}/status-json.xsl`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) return channels;

    const json = await res.json() as { icestats?: { source?: Array<{ listenurl?: string; listeners?: number }> } };
    const sources = json.icestats?.source ?? [];

    return channels.map((ch) => {
      const source = sources.find((s) =>
        s.listenurl?.includes(ch.slug),
      );
      return {
        ...ch,
        listenerCount: source?.listeners ?? ch.listenerCount,
      };
    });
  } catch {
    return channels;
  }
}
