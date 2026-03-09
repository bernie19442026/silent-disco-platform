import { Router } from 'express';
import { getIcecastSources } from '../services/streamMonitor';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const slugs = ['channel1', 'channel2', 'channel3', 'channel4'];

  let icecastStatus: 'ok' | 'unreachable' = 'unreachable';
  const channelStatuses: Record<string, 'live' | 'offline'> = {};

  try {
    const sources = await getIcecastSources();
    icecastStatus = 'ok';

    for (const slug of slugs) {
      const active = sources.some((s) => s.listenurl?.includes(slug));
      channelStatuses[slug] = active ? 'live' : 'offline';
    }
  } catch {
    for (const slug of slugs) channelStatuses[slug] = 'offline';
  }

  const allLive = Object.values(channelStatuses).every((s) => s === 'live');
  const anyLive = Object.values(channelStatuses).some((s) => s === 'live');

  const report = {
    status: allLive ? 'ok' : anyLive ? 'degraded' : 'down',
    icecast: icecastStatus,
    channels: channelStatuses,
    checkedAt: new Date().toISOString(),
  };

  res.status(report.status === 'down' ? 503 : 200).json(report);
});
