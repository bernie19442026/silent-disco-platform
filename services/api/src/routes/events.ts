import { Router } from 'express';
import { getIcecastSources } from '../services/streamMonitor';

export const eventsRouter = Router();

eventsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;

  // In production, load from a database keyed by event ID.
  // This static config supports the demo/default event.
  if (id !== (process.env.EVENT_ID ?? 'demo') && id !== 'demo') {
    res.status(404).json({ ok: false, error: 'Event not found' });
    return;
  }

  const sources = await getIcecastSources().catch(() => []);
  const totalListeners = sources.reduce((s, src) => s + (src.listeners ?? 0), 0);

  const baseUrl = process.env.STREAMING_BASE_URL ?? 'http://localhost:8000';
  const hlsBase = baseUrl.replace(':8000', ':8080');

  const event = {
    id,
    name: process.env.EVENT_NAME ?? 'Silent Disco',
    venue: process.env.EVENT_VENUE,
    isLive: true,
    totalListeners,
    primaryColor: '#6366f1',
    channels: [1, 2, 3, 4].map((num) => {
      const slug = `channel${num}`;
      const source = sources.find((s) => s.listenurl?.includes(slug));
      return {
        id: num,
        slug,
        name: ['Main Mix', 'DJ Booth', 'Stage Feed', 'Crowd Mix'][num - 1],
        description: [
          'Full front-of-house mix',
          'Direct DJ monitor feed',
          'Stage monitor & instrument mix',
          'Ambient crowd & atmosphere',
        ][num - 1],
        color: ['#6366f1', '#ec4899', '#f59e0b', '#10b981'][num - 1],
        emoji: ['🎵', '🎛️', '🎸', '🌊'][num - 1],
        status: source ? 'live' : 'offline',
        listenerCount: source?.listeners ?? 0,
        endpoints: [
          { format: 'ogg', url: `${baseUrl}/${slug}.ogg`, codec: 'opus', bitrate: 128, priority: 0 },
          { format: 'hls', url: `${hlsBase}/hls/${slug}/index.m3u8`, codec: 'aac', bitrate: 128, priority: 1 },
          { format: 'mp3', url: `${baseUrl}/${slug}.mp3`, codec: 'mp3', bitrate: 128, priority: 2 },
        ],
      };
    }),
  };

  res.json({ data: event, ok: true });
});
