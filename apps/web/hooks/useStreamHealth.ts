/**
 * Subscribes to the /api/stream-status SSE endpoint.
 * Updates listener counts and channel statuses in the player store.
 */

'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import type { Channel } from '../lib/types';

interface StatusMessage {
  type: 'health' | 'listeners' | 'ping';
  channels?: Array<{
    id: number;
    status: Channel['status'];
    listenerCount: number;
  }>;
}

export function useStreamHealth(eventId: string) {
  const updateListenerCount = usePlayerStore((s) => s.updateListenerCount);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;

    const url = `/api/stream-status?eventId=${eventId}`;
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource(url);

      es.onmessage = (evt) => {
        try {
          const msg: StatusMessage = JSON.parse(evt.data as string);
          if (msg.type === 'listeners' || msg.type === 'health') {
            msg.channels?.forEach((ch) => {
              updateListenerCount(ch.id, ch.listenerCount);
            });
          }
        } catch {
          // Ignore malformed messages
        }
      };

      es.onerror = () => {
        es.close();
        reconnectTimer = setTimeout(connect, 5_000);
      };
    }

    connect();

    return () => {
      es?.close();
      clearTimeout(reconnectTimer);
    };
  }, [eventId, updateListenerCount]);
}
