/**
 * Standalone API service (Node.js/Express).
 * Used when running the backend outside of Vercel — e.g., on Fly.io, DO, or bare metal.
 *
 * Provides:
 *  - /api/channels         Channel config + live listener counts
 *  - /api/events/:id       Full event config
 *  - /api/health           Streaming infrastructure health check
 *  - /api/analytics        Ingest analytics events
 *  - /api/stream-status    SSE listener/status feed
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { channelsRouter } from './routes/channels';
import { eventsRouter } from './routes/events';
import { healthRouter } from './routes/health';
import { analyticsRouter } from './routes/analytics';
import { streamStatusRouter } from './routes/streamStatus';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── Middleware ───────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
);
app.use(express.json({ limit: '16kb' }));

// Request logging (lightweight)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────

app.use('/api/channels', channelsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/health', healthRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/stream-status', streamStatusRouter);

app.get('/', (_req, res) => {
  res.json({ service: 'silent-disco-api', version: '1.0.0', ok: true });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] Listening on port ${PORT}`);
  console.log(`[api] Icecast: ${process.env.ICECAST_URL ?? 'not configured'}`);
});
