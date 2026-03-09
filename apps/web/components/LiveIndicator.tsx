'use client';

import { usePlayerStore } from '../store/playerStore';

interface Props {
  totalListeners: number;
}

export function LiveIndicator({ totalListeners }: Props) {
  const playerState = usePlayerStore((s) => s.playerState);
  const reconnectCount = usePlayerStore((s) => s.reconnectCount);
  const bufferHealth = usePlayerStore((s) => s.bufferHealth);

  const isLive = playerState === 'playing';
  const isBuffering = playerState === 'buffering';
  const isReconnecting = playerState === 'reconnecting';

  return (
    <div className="flex items-center gap-4 text-sm">
      {/* Live dot */}
      <div className="flex items-center gap-1.5">
        <span
          className={[
            'inline-block h-2.5 w-2.5 rounded-full',
            isLive ? 'bg-red-500 animate-pulse' : '',
            isBuffering ? 'bg-yellow-500 animate-ping' : '',
            isReconnecting ? 'bg-orange-500 animate-bounce' : '',
            !isLive && !isBuffering && !isReconnecting ? 'bg-gray-500' : '',
          ].join(' ')}
        />
        <span className="font-semibold uppercase tracking-widest text-xs text-white/80">
          {isLive
            ? 'LIVE'
            : isBuffering
              ? 'BUFFERING'
              : isReconnecting
                ? `RECONNECTING${reconnectCount > 1 ? ` (${reconnectCount})` : ''}`
                : 'OFFLINE'}
        </span>
      </div>

      {/* Buffer health bar */}
      {isLive && (
        <div className="hidden sm:flex items-center gap-1.5">
          <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${bufferHealth * 100}%`,
                background:
                  bufferHealth > 0.6
                    ? '#22c55e'
                    : bufferHealth > 0.3
                      ? '#eab308'
                      : '#ef4444',
              }}
            />
          </div>
          <span className="text-white/40 text-xs">buf</span>
        </div>
      )}

      {/* Listener count */}
      <div className="text-white/60 text-xs">
        {totalListeners.toLocaleString()} listening
      </div>
    </div>
  );
}
