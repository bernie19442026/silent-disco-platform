/**
 * Icecast stats fetcher with in-memory cache.
 * Reduces load on Icecast when many SSE clients are connected.
 */

interface IcecastSource {
  listenurl?: string;
  listeners?: number;
  stream_start?: string;
  bitrate?: number;
  audio_info?: string;
}

interface CacheEntry {
  sources: IcecastSource[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 3_000;
let cache: CacheEntry | null = null;
let inFlight: Promise<IcecastSource[]> | null = null;

export async function getIcecastSources(): Promise<IcecastSource[]> {
  const now = Date.now();

  // Serve from cache if fresh
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.sources;
  }

  // Deduplicate concurrent requests
  if (inFlight) return inFlight;

  inFlight = fetchFromIcecast().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function fetchFromIcecast(): Promise<IcecastSource[]> {
  const url = process.env.ICECAST_URL ?? 'http://localhost:8000';

  const res = await fetch(`${url}/status-json.xsl`, {
    signal: AbortSignal.timeout(4_000),
  });

  if (!res.ok) throw new Error(`Icecast returned ${res.status}`);

  const json = await res.json() as { icestats?: { source?: IcecastSource | IcecastSource[] } };

  // Icecast returns a single object when there is only one source
  const raw = json.icestats?.source;
  const sources: IcecastSource[] = Array.isArray(raw)
    ? raw
    : raw
      ? [raw]
      : [];

  cache = { sources, fetchedAt: Date.now() };
  return sources;
}
