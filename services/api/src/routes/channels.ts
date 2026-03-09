import { Router } from 'express';
import { getIcecastSources } from '../services/streamMonitor';

export const channelsRouter = Router();

const BASE_STREAM_URL = process.env.STREAMING_BASE_URL ?? 'http://localhost:8000';

function buildChannels() {
  return [1, 2, 3, 4].map((id) => ({
    id,
    slug: `channel${id}`,
    name: ['Main Mix', 'DJ Booth', 'Stage Feed', 'Crowd Mix'][id - 1],
    description: [
      'Full front-of-house mix',
      'Direct DJ monitor feed',
      'Stage monitor & instrument mix',
      'Ambient crowd & atmosphere',
    ][id - 1],
    color: ['#6366f1', '#ec4899', '#f59e0b', '#10b981'][id - 1],
    emoji: ['🎵', '🎛️', '🎸', '🌊'][id - 1],
    status: 'live' as const,
    listenerCount: 0,
    endpoints: [
      {
        format: 'ogg',
        url: `${BASE_STREAM_URL}/channel${id}.ogg`,
        codec: 'opus',
        bitrate: 128,
        latencyMs: 2500,
        priority: 0,
      },
      {
        format: 'hls',
        url: `${BASE_STREAM_URL.replace(':8000', ':8080')}/hls/channel${id}/index.m3u8`,
        codec: 'aac',
        bitrate: 128,
        latencyMs: 6000,
        priority: 1,
      },
      {
        format: 'mp3',
        url: `${BASE_STREAM_URL}/channel${id}.mp3`,
        codec: 'mp3',
        bitrate: 128,
        latencyMs: 3000,
        priority: 2,
      },
    ],
  }));
}

channelsRouter.get('/', async (_req, res) => {
  try {
    const channels = buildChannels();
    const sources = await getIcecastSources();

    // Enrich with live listener counts
    const enriched = channels.map((ch) => {
      const source = sources.find((s) => s.listenurl?.includes(ch.slug));
      return {
        ...ch,
        status: source ? ('live' as const) : ('offline' as const),
        listenerCount: source?.listeners ?? 0,
      };
    });

    res.json({ data: enriched, ok: true });
  } catch (err) {
    console.error('[channels]', err);
    res.status(500).json({ ok: false, error: 'Failed to load channels' });
  }
});
