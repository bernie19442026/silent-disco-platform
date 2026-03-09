/**
 * Client-side analytics — fire-and-forget events to the backend API.
 * Never blocks the audio path.
 */

import type { AnalyticsEvent } from './types';

let _sessionId: string | null = null;

function getSessionId(): string {
  if (_sessionId) return _sessionId;
  if (typeof window !== 'undefined') {
    let id = sessionStorage.getItem('sd_session');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('sd_session', id);
    }
    _sessionId = id;
    return id;
  }
  return 'ssr';
}

async function send(payload: AnalyticsEvent): Promise<void> {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Analytics must never throw
  }
}

function buildEvent(
  eventId: string,
  channelId: number,
  action: AnalyticsEvent['action'],
  metadata?: Record<string, unknown>,
): AnalyticsEvent {
  return {
    eventId,
    channelId,
    sessionId: getSessionId(),
    action,
    metadata,
    timestamp: new Date().toISOString(),
  };
}

export function trackJoin(eventId: string, channelId: number): void {
  void send(buildEvent(eventId, channelId, 'join'));
}

export function trackLeave(eventId: string, channelId: number): void {
  void send(buildEvent(eventId, channelId, 'leave'));
}

export function trackSwitch(
  eventId: string,
  fromChannelId: number,
  toChannelId: number,
): void {
  void send(
    buildEvent(eventId, toChannelId, 'switch', { from: fromChannelId }),
  );
}

export function trackError(
  eventId: string,
  channelId: number,
  message: string,
): void {
  void send(buildEvent(eventId, channelId, 'error', { message }));
}
