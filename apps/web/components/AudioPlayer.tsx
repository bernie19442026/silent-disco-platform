/**
 * Root player component.
 * Wires together channel selection, audio engine, and UI.
 */

'use client';

import { useCallback } from 'react';
import { ChannelCard } from './ChannelCard';
import { VolumeControl } from './VolumeControl';
import { AudioVisualizer } from './AudioVisualizer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useStreamHealth } from '../hooks/useStreamHealth';
import { usePlayerStore } from '../store/playerStore';
import { trackJoin, trackSwitch } from '../lib/analytics';
import type { Event } from '../lib/types';

interface Props {
  event: Event;
}

export function AudioPlayer({ event }: Props) {
  const { setActiveChannel, activeChannelId, playerState, error } =
    usePlayerStore((s) => ({
      setActiveChannel: s.setActiveChannel,
      activeChannelId: s.activeChannelId,
      playerState: s.playerState,
      error: s.error,
    }));

  // Boot audio engine
  useAudioPlayer(event.channels);

  // Subscribe to SSE health updates
  useStreamHealth(event.id);

  const handleChannelSelect = useCallback(
    (id: number) => {
      if (id === activeChannelId) return;

      if (activeChannelId !== null) {
        trackSwitch(event.id, activeChannelId, id);
      } else {
        trackJoin(event.id, id);
      }

      setActiveChannel(id);
    },
    [activeChannelId, event.id, setActiveChannel],
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Channel grid */}
      <section aria-label="Audio channels">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {event.channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onSelect={handleChannelSelect}
            />
          ))}
        </div>
      </section>

      {/* Player controls */}
      <section
        aria-label="Playback controls"
        className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 border border-white/10 px-5 py-4"
      >
        {activeChannelId !== null ? (
          <>
            <div className="text-center">
              <div className="text-xs text-white/40 uppercase tracking-widest mb-0.5">
                {playerState === 'playing'
                  ? 'Now playing'
                  : playerState === 'loading'
                    ? 'Connecting…'
                    : playerState === 'buffering'
                      ? 'Buffering…'
                      : playerState === 'reconnecting'
                        ? 'Reconnecting…'
                        : ''}
              </div>
              <div className="font-bold text-white">
                {event.channels.find((c) => c.id === activeChannelId)?.name ?? ''}
              </div>
            </div>
            {/* Audio Visualizer */}
            <div className="w-full px-2">
              <AudioVisualizer
                color={event.channels.find((c) => c.id === activeChannelId)?.color ?? '#6366f1'}
                barCount={24}
                height={36}
              />
            </div>
            <VolumeControl />
          </>
        ) : (
          <p className="text-white/40 text-sm">
            Select a channel above to start listening
          </p>
        )}

        {error && (
          <div className="text-red-400 text-xs text-center bg-red-400/10 rounded-lg px-3 py-2 w-full">
            {error}
          </div>
        )}
      </section>

      {/* Headphone prompt for mobile */}
      {activeChannelId === null && (
        <p className="text-center text-white/30 text-xs">
          🎧 Put your headphones in and pick a channel
        </p>
      )}
    </div>
  );
}
