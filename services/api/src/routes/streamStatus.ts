import { Router, Request, Response } from 'express';
import { getIcecastSources } from '../services/streamMonitor';

export const streamStatusRouter = Router();

const SLUGS = ['channel1', 'channel2', 'channel3', 'channel4'];
const CHANNEL_IDS = [1, 2, 3, 4];
const POLL_MS = 5_000;

streamStatusRouter.get('/', (req: Request, res: Response) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  });

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Initial ping
  send({ type: 'ping' });

  const interval = setInterval(async () => {
    try {
      const sources = await getIcecastSources();

      const channels = SLUGS.map((slug, i) => {
        const src = sources.find((s) => s.listenurl?.includes(slug));
        return {
          id: CHANNEL_IDS[i],
          slug,
          status: src ? 'live' : 'offline',
          listenerCount: src?.listeners ?? 0,
        };
      });

      send({
        type: 'health',
        channels,
        timestamp: new Date().toISOString(),
      });
    } catch {
      send({ type: 'ping' });
    }
  }, POLL_MS);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});
