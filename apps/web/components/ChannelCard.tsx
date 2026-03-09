'use client';

import { usePlayerStore } from '../store/playerStore';
import type { Channel } from '../lib/types';

interface Props {
  channel: Channel;
  onSelect: (id: number) => void;
}

// Animated equaliser bars (CSS-only)
function EqBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-6">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="w-[3px] rounded-sm"
          style={{
            height: active ? `${20 + Math.random() * 0}%` : '30%',
            background: active ? 'currentColor' : 'rgba(255,255,255,0.2)',
            animation: active ? `eq${i} ${0.6 + i * 0.1}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes eq1 { from { height: 30% } to { height: 90% } }
        @keyframes eq2 { from { height: 60% } to { height: 40% } }
        @keyframes eq3 { from { height: 70% } to { height: 100% } }
        @keyframes eq4 { from { height: 40% } to { height: 70% } }
        @keyframes eq5 { from { height: 80% } to { height: 30% } }
      `}</style>
    </div>
  );
}

export function ChannelCard({ channel, onSelect }: Props) {
  const activeChannelId = usePlayerStore((s) => s.activeChannelId);
  const playerState = usePlayerStore((s) => s.playerState);
  const listenerCount = usePlayerStore(
    (s) => s.listenerCounts[channel.id] ?? channel.listenerCount,
  );

  const isActive = activeChannelId === channel.id;
  const isPlaying = isActive && playerState === 'playing';
  const isLoading = isActive && (playerState === 'loading' || playerState === 'buffering');
  const isOffline = channel.status === 'offline';

  return (
    <button
      onClick={() => !isOffline && onSelect(channel.id)}
      disabled={isOffline}
      aria-pressed={isActive}
      aria-label={`${channel.name}${isActive ? ' — now playing' : ''}`}
      data-testid="channel-card"
      className={[
        'relative w-full rounded-2xl p-4 text-left transition-all duration-200 select-none',
        'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        isOffline
          ? 'opacity-40 cursor-not-allowed border-white/10 bg-white/5'
          : isActive
            ? 'border-transparent scale-[1.02] shadow-xl'
            : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]',
      ].join(' ')}
      style={
        isActive
          ? {
              background: `linear-gradient(135deg, ${channel.color}33 0%, ${channel.color}11 100%)`,
              borderColor: channel.color,
              boxShadow: `0 0 30px ${channel.color}40`,
            }
          : undefined
      }
    >
      {/* Channel colour accent */}
      <div
        className="absolute top-3 right-3 h-2 w-2 rounded-full"
        style={{ background: isOffline ? '#6b7280' : channel.color }}
      />

      {/* Channel number badge */}
      <div
        className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60"
        style={{ color: isActive ? channel.color : undefined }}
      >
        CH {channel.id}
      </div>

      {/* Name */}
      <div className="font-black text-lg leading-tight text-white mb-1">
        {channel.emoji && <span className="mr-1.5">{channel.emoji}</span>}
        {channel.name}
      </div>

      {/* Description */}
      {channel.description && (
        <div className="text-white/50 text-xs leading-snug mb-3">
          {channel.description}
        </div>
      )}

      {/* Bottom row: EQ + listeners */}
      <div className="flex items-center justify-between mt-2">
        <div style={{ color: channel.color }}>
          {isLoading ? (
            <div className="flex gap-1 items-center text-white/60 text-xs">
              <span className="animate-spin">⟳</span> Connecting…
            </div>
          ) : (
            <EqBars active={isPlaying} />
          )}
        </div>

        <div className="text-xs text-white/40">
          {isOffline ? 'Offline' : `${listenerCount.toLocaleString()} here`}
        </div>
      </div>

      {/* Track metadata */}
      {isActive && channel.metadata?.title && (
        <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/60 truncate">
          ♪ {channel.metadata.artist ? `${channel.metadata.artist} — ` : ''}
          {channel.metadata.title}
        </div>
      )}
    </button>
  );
}
