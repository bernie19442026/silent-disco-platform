import { NextResponse } from 'next/server';
import { buildDefaultEndpoints } from '../../../lib/streaming';
import type { Event } from '../../../lib/types';

export async function GET() {
  const event = await buildEventConfig();
  return NextResponse.json({ data: event, ok: true });
}

async function buildEventConfig(): Promise<Event> {
  const base: Event = {
    id: process.env.NEXT_PUBLIC_EVENT_ID ?? 'demo',
    name: process.env.NEXT_PUBLIC_EVENT_NAME ?? 'Silent Disco',
    venue: process.env.NEXT_PUBLIC_EVENT_VENUE,
    isLive: true,
    totalListeners: 0,
    primaryColor: '#6366f1',
    channels: [
      {
        id: 1, slug: 'channel1', name: 'Main Mix',
        description: 'Full front-of-house mix', color: '#6366f1', emoji: '🎵',
        status: 'live', listenerCount: 0, endpoints: buildDefaultEndpoints('channel1'),
      },
      {
        id: 2, slug: 'channel2', name: 'DJ Booth',
        description: 'Direct DJ monitor feed', color: '#ec4899', emoji: '🎛️',
        status: 'live', listenerCount: 0, endpoints: buildDefaultEndpoints('channel2'),
      },
      {
        id: 3, slug: 'channel3', name: 'Stage Feed',
        description: 'Stage monitor & instrument mix', color: '#f59e0b', emoji: '🎸',
        status: 'live', listenerCount: 0, endpoints: buildDefaultEndpoints('channel3'),
      },
      {
        id: 4, slug: 'channel4', name: 'Crowd Mix',
        description: 'Ambient crowd & atmosphere', color: '#10b981', emoji: '🌊',
        status: 'live', listenerCount: 0, endpoints: buildDefaultEndpoints('channel4'),
      },
    ],
  };

  // Enrich with live listener totals from Icecast
  const icecastUrl = process.env.ICECAST_STATS_URL;
  if (icecastUrl) {
    try {
      const res = await fetch(`${icecastUrl}/status-json.xsl`, {
        next: { revalidate: 10 },
      });
      if (res.ok) {
        const json = await res.json() as { icestats?: { source?: Array<{ listeners?: number }> } };
        const sources = json.icestats?.source ?? [];
        const total = sources.reduce((sum, s) => sum + (s.listeners ?? 0), 0);
        base.totalListeners = total;
      }
    } catch {
      // Non-fatal
    }
  }

  return base;
}
