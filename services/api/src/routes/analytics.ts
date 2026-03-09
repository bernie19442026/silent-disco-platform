import { Router, Request, Response } from 'express';

export const analyticsRouter = Router();

interface AnalyticsEvent {
  eventId: string;
  channelId: number;
  sessionId: string;
  action: 'join' | 'leave' | 'switch' | 'pause' | 'resume' | 'error';
  metadata?: Record<string, unknown>;
  timestamp: string;
}

analyticsRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as AnalyticsEvent;

  if (!body?.eventId || !body?.action || !body?.sessionId) {
    res.status(400).json({ ok: false, error: 'Missing required fields' });
    return;
  }

  // Enrich with server-side data
  const enriched = {
    ...body,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    receivedAt: new Date().toISOString(),
  };

  // Forward to analytics backend if configured
  const endpoint = process.env.ANALYTICS_ENDPOINT;
  if (endpoint) {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ANALYTICS_API_KEY
            ? { Authorization: `Bearer ${process.env.ANALYTICS_API_KEY}` }
            : {}),
        },
        body: JSON.stringify(enriched),
      });
    } catch (err) {
      console.warn('[analytics] Failed to forward event:', err);
    }
  } else {
    // Dev mode: just log it
    console.log('[analytics]', JSON.stringify(enriched));
  }

  res.json({ ok: true });
});
