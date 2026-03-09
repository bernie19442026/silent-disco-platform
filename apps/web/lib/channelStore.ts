// /Users/bernie/silent-disco-platform/apps/web/lib/channelStore.ts
/**
 * In-memory channel config store with optional PostgreSQL persistence.
 * Falls back gracefully when no DATABASE_URL is set.
 */

export type SourceType = 'icecast' | 'hls' | 'webrtc' | 'file' | 'external';

export interface AdminChannel {
  id: number;
  slug: string;
  name: string;
  description: string;
  color: string;
  emoji: string;
  status: 'live' | 'offline' | 'degraded' | 'starting';
  sourceType: SourceType;
  sourceUrl: string;
  uploadedFile?: string; // filename of uploaded audio
  listenerCount: number;
  updatedAt: string;
}

// Default channel config
const defaultChannels: AdminChannel[] = [
  {
    id: 1, slug: 'channel1', name: 'Main Stage', description: 'Full front-of-house mix',
    color: '#6366f1', emoji: '🎵', status: 'live', sourceType: 'icecast',
    sourceUrl: '/channel1.ogg', listenerCount: 0, updatedAt: new Date().toISOString(),
  },
  {
    id: 2, slug: 'channel2', name: 'DJ Stage', description: 'Direct DJ monitor feed',
    color: '#ec4899', emoji: '🎛️', status: 'live', sourceType: 'icecast',
    sourceUrl: '/channel2.ogg', listenerCount: 0, updatedAt: new Date().toISOString(),
  },
  {
    id: 3, slug: 'channel3', name: 'VIP Mix', description: 'Stage monitor & instrument mix',
    color: '#f59e0b', emoji: '🎸', status: 'offline', sourceType: 'icecast',
    sourceUrl: '/channel3.ogg', listenerCount: 0, updatedAt: new Date().toISOString(),
  },
  {
    id: 4, slug: 'channel4', name: 'Crowd Ambience', description: 'Ambient crowd & atmosphere',
    color: '#10b981', emoji: '🌊', status: 'offline', sourceType: 'icecast',
    sourceUrl: '/channel4.ogg', listenerCount: 0, updatedAt: new Date().toISOString(),
  },
];

// Runtime in-memory store (survives hot reloads in dev via globalThis)
declare global {
  // eslint-disable-next-line no-var
  var __channelStore: AdminChannel[] | undefined;
}

function getStore(): AdminChannel[] {
  if (!globalThis.__channelStore) {
    globalThis.__channelStore = JSON.parse(JSON.stringify(defaultChannels));
  }
  return globalThis.__channelStore!;
}

export function getAllChannels(): AdminChannel[] {
  return getStore();
}

export function getChannel(id: number): AdminChannel | undefined {
  return getStore().find((c) => c.id === id);
}

export function updateChannel(id: number, updates: Partial<AdminChannel>): AdminChannel | null {
  const store = getStore();
  const idx = store.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], ...updates, id, updatedAt: new Date().toISOString() };
  return store[idx];
}

// Analytics in-memory store
interface ListenerEvent {
  channelId: number;
  action: string;
  sessionId: string;
  timestamp: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __analyticsStore: ListenerEvent[] | undefined;
  // eslint-disable-next-line no-var
  var __listenerCounts: Record<number, number> | undefined;
}

export function recordAnalytics(event: ListenerEvent): void {
  if (!globalThis.__analyticsStore) globalThis.__analyticsStore = [];
  globalThis.__analyticsStore.push(event);
  // Keep last 10000 events
  if (globalThis.__analyticsStore.length > 10000) {
    globalThis.__analyticsStore = globalThis.__analyticsStore.slice(-10000);
  }

  // Update listener counts
  if (!globalThis.__listenerCounts) globalThis.__listenerCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  if (event.action === 'join' || event.action === 'switch_to') {
    globalThis.__listenerCounts[event.channelId] = (globalThis.__listenerCounts[event.channelId] ?? 0) + 1;
  } else if (event.action === 'leave' || event.action === 'switch_from') {
    globalThis.__listenerCounts[event.channelId] = Math.max(0, (globalThis.__listenerCounts[event.channelId] ?? 1) - 1);
  }
}

export function getListenerCounts(): Record<number, number> {
  return globalThis.__listenerCounts ?? { 1: 0, 2: 0, 3: 0, 4: 0 };
}

export function getAnalyticsEvents(): ListenerEvent[] {
  return globalThis.__analyticsStore ?? [];
}
