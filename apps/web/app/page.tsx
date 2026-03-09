/**
 * Main page — fetches event config server-side, renders the player client-side.
 */

import { Suspense } from 'react';
import { EventHeader } from '../components/EventHeader';
import { AudioPlayer } from '../components/AudioPlayer';
import { QRCodeButton } from '../components/QRCodeModal';
import { buildDefaultEndpoints } from '../lib/streaming';
import type { Event } from '../lib/types';

// ─── Static fallback event (used when API is unavailable) ────

const FALLBACK_EVENT: Event = {
  id: process.env.NEXT_PUBLIC_EVENT_ID ?? 'demo',
  name: process.env.NEXT_PUBLIC_EVENT_NAME ?? 'Signal Disco',
  venue: process.env.NEXT_PUBLIC_EVENT_VENUE ?? undefined,
  isLive: true,
  totalListeners: 0,
  primaryColor: '#6366f1',
  channels: [
    {
      id: 1,
      slug: 'channel1',
      name: 'Main Mix',
      description: 'Full front-of-house mix',
      color: '#6366f1',
      emoji: '🎵',
      status: 'live',
      listenerCount: 0,
      endpoints: buildDefaultEndpoints('channel1'),
    },
    {
      id: 2,
      slug: 'channel2',
      name: 'DJ Booth',
      description: 'Direct DJ monitor feed',
      color: '#ec4899',
      emoji: '🎛️',
      status: 'live',
      listenerCount: 0,
      endpoints: buildDefaultEndpoints('channel2'),
    },
    {
      id: 3,
      slug: 'channel3',
      name: 'Stage Feed',
      description: 'Stage monitor & instrument mix',
      color: '#f59e0b',
      emoji: '🎸',
      status: 'live',
      listenerCount: 0,
      endpoints: buildDefaultEndpoints('channel3'),
    },
    {
      id: 4,
      slug: 'channel4',
      name: 'Crowd Mix',
      description: 'Ambient crowd & atmosphere',
      color: '#10b981',
      emoji: '🌊',
      status: 'live',
      listenerCount: 0,
      endpoints: buildDefaultEndpoints('channel4'),
    },
  ],
};

// ─── Server-side event fetch ──────────────────────────────────

async function fetchEvent(): Promise<Event> {
  const eventId = process.env.NEXT_PUBLIC_EVENT_ID ?? 'demo';
  const apiBase = process.env.API_INTERNAL_URL ?? '';

  if (!apiBase) return FALLBACK_EVENT;

  try {
    const res = await fetch(`${apiBase}/api/events/${eventId}`, {
      next: { revalidate: 30 }, // ISR — refresh every 30s
    });
    if (!res.ok) return FALLBACK_EVENT;
    const json = await res.json() as { data: Event };
    return json.data;
  } catch {
    return FALLBACK_EVENT;
  }
}

// ─── Page component ───────────────────────────────────────────

export default async function HomePage() {
  const event = await fetchEvent();

  return (
    <main className="min-h-dvh flex flex-col">
      {/* Ambient background pattern */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 60%)',
        }}
      />

      <div className="relative flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pb-8">
        <EventHeader event={event} />

        <Suspense fallback={<PlayerSkeleton />}>
          <AudioPlayer event={event} />
        </Suspense>

        <footer className="mt-auto pt-8 text-center text-white/20 text-xs flex items-center justify-center gap-4">
          <span>Signal Disco · Powered by Opus</span>
          <QRCodeButton />
        </footer>
      </div>
    </main>
  );
}

function PlayerSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-36 rounded-2xl bg-white/5" />
      ))}
    </div>
  );
}
