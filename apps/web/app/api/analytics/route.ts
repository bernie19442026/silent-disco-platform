import { NextRequest, NextResponse } from 'next/server';
import type { AnalyticsEvent } from '../../../lib/types';

export async function POST(req: NextRequest) {
  let body: AnalyticsEvent;

  try {
    body = await req.json() as AnalyticsEvent;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate minimum required fields
  if (!body.eventId || !body.action || !body.sessionId) {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields' },
      { status: 400 },
    );
  }

  // Forward to an external analytics service if configured.
  // Otherwise, just log. In production: write to ClickHouse, Plausible, etc.
  const analyticsEndpoint = process.env.ANALYTICS_ENDPOINT;
  if (analyticsEndpoint) {
    try {
      await fetch(analyticsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ANALYTICS_API_KEY
            ? { Authorization: `Bearer ${process.env.ANALYTICS_API_KEY}` }
            : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Non-fatal — analytics must not affect the user
    }
  } else {
    console.log('[analytics]', JSON.stringify(body));
  }

  return NextResponse.json({ ok: true });
}
