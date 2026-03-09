/**
 * Streaming utilities — codec detection, URL resolution, reconnection.
 */

import type { Channel, StreamEndpoint, StreamFormat } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_STREAMING_BASE_URL ?? 'http://localhost:8000';

// ─── Codec / format capability detection ────────────────────

let _supportsOpusOgg: boolean | null = null;
let _supportsHLS: boolean | null = null;

export function supportsOpusOgg(): boolean {
  if (typeof document === 'undefined') return false;
  if (_supportsOpusOgg !== null) return _supportsOpusOgg;
  const a = document.createElement('audio');
  _supportsOpusOgg = a.canPlayType('audio/ogg; codecs="opus"') !== '';
  return _supportsOpusOgg;
}

export function supportsHLS(): boolean {
  if (typeof document === 'undefined') return false;
  if (_supportsHLS !== null) return _supportsHLS;
  const a = document.createElement('audio');
  _supportsHLS =
    a.canPlayType('application/vnd.apple.mpegurl') !== '' ||
    a.canPlayType('audio/x-mpegurl') !== '';
  return _supportsHLS;
}

// Returns true when we need hls.js (Chrome-class browsers don't parse HLS natively)
export function needsHlsJs(): boolean {
  return !supportsHLS() && typeof window !== 'undefined';
}

// ─── URL helpers ─────────────────────────────────────────────

export function opusUrl(channelSlug: string): string {
  return `${BASE_URL}/${channelSlug}.ogg`;
}

export function hlsUrl(channelSlug: string): string {
  return `${BASE_URL}/hls/${channelSlug}/index.m3u8`;
}

export function mp3Url(channelSlug: string): string {
  return `${BASE_URL}/${channelSlug}.mp3`;
}

/**
 * Returns the best StreamEndpoint for the current browser,
 * falling back through Opus → HLS → MP3.
 */
export function pickBestEndpoint(channel: Channel): StreamEndpoint | null {
  if (!channel.endpoints || channel.endpoints.length === 0) return null;

  const sorted = [...channel.endpoints].sort((a, b) => a.priority - b.priority);

  for (const ep of sorted) {
    if (ep.format === 'ogg' && supportsOpusOgg()) return ep;
    if (ep.format === 'hls') return ep; // hls.js will handle it if needed
    if (ep.format === 'mp3') return ep;
  }

  return sorted[0];
}

/** Build a default endpoint list for a channel slug */
export function buildDefaultEndpoints(channelSlug: string): StreamEndpoint[] {
  return [
    {
      format: 'ogg' as StreamFormat,
      url: opusUrl(channelSlug),
      codec: 'opus',
      bitrate: 128,
      latencyMs: 2500,
      priority: 0,
    },
    {
      format: 'hls' as StreamFormat,
      url: hlsUrl(channelSlug),
      codec: 'aac',
      bitrate: 128,
      latencyMs: 6000,
      priority: 1,
    },
    {
      format: 'mp3' as StreamFormat,
      url: mp3Url(channelSlug),
      codec: 'mp3',
      bitrate: 128,
      latencyMs: 3000,
      priority: 2,
    },
  ];
}

// ─── Reconnection with exponential back-off ──────────────────

const BACKOFF_TABLE = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];

export class ReconnectScheduler {
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  schedule(fn: () => void): void {
    this.clear();
    const delay = BACKOFF_TABLE[Math.min(this.attempt, BACKOFF_TABLE.length - 1)];
    this.attempt++;
    this.timer = setTimeout(fn, delay);
  }

  reset(): void {
    this.attempt = 0;
    this.clear();
  }

  clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  get attemptCount(): number {
    return this.attempt;
  }
}

// ─── Stream health probe ─────────────────────────────────────

export async function probeStreamUrl(url: string, timeoutMs = 5_000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(tid);
    return res.ok;
  } catch {
    return false;
  }
}
