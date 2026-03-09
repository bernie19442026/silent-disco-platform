/**
 * Core audio engine hook.
 *
 * Responsibilities:
 *  - Manage a single HTMLAudioElement
 *  - Select Ogg/Opus or HLS stream per browser capability
 *  - Handle channel switching with smooth crossfade
 *  - Implement exponential-backoff reconnection
 *  - Report buffer health & latency to the store
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import type Hls from 'hls.js';
import { usePlayerStore } from '../store/playerStore';
import { pickBestEndpoint, ReconnectScheduler } from '../lib/streaming';
import type { Channel } from '../lib/types';

const FADE_DURATION_MS = 300;

export function useAudioPlayer(channels: Channel[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulerRef = useRef(new ReconnectScheduler());
  const bufferTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    activeChannelId,
    volume,
    isMuted,
    setPlayerState,
    setLatency,
    setBufferHealth,
    setError,
    incrementReconnect,
    resetReconnect,
  } = usePlayerStore();

  // ─── Bootstrap audio element once ────────────────────────

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      hlsRef.current?.destroy();
      schedulerRef.current.clear();
      if (bufferTimerRef.current) clearInterval(bufferTimerRef.current);
    };
  }, []);

  // ─── Sync volume / mute ───────────────────────────────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // ─── Buffer health poller ─────────────────────────────────

  const startBufferPoller = useCallback(() => {
    if (bufferTimerRef.current) clearInterval(bufferTimerRef.current);
    bufferTimerRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;

      // Estimate playback position relative to buffer end
      const buffered = audio.buffered;
      if (buffered.length > 0) {
        const bufferEnd = buffered.end(buffered.length - 1);
        const gap = bufferEnd - audio.currentTime;
        // Healthy buffer ≥ 2s; cap health at 1
        setBufferHealth(Math.min(1, gap / 2));

        // Rough latency estimate: gap behind live edge
        setLatency(Math.round(gap * 1000));
      }
    }, 1_000);
  }, [setBufferHealth, setLatency]);

  // ─── Attach audio event listeners ─────────────────────────

  const attachListeners = useCallback(
    (audio: HTMLAudioElement) => {
      const onPlaying = () => {
        setPlayerState('playing');
        resetReconnect();
        schedulerRef.current.reset();
        startBufferPoller();
      };

      const onWaiting = () => setPlayerState('buffering');

      const onError = () => {
        setPlayerState('reconnecting');
        incrementReconnect();
        schedulerRef.current.schedule(() => {
          const id = usePlayerStore.getState().activeChannelId;
          if (id !== null) triggerChannelLoad(id);
        });
      };

      const onStalled = () => {
        setPlayerState('buffering');
      };

      audio.addEventListener('playing', onPlaying);
      audio.addEventListener('waiting', onWaiting);
      audio.addEventListener('error', onError);
      audio.addEventListener('stalled', onStalled);

      return () => {
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('waiting', onWaiting);
        audio.removeEventListener('error', onError);
        audio.removeEventListener('stalled', onStalled);
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setPlayerState, resetReconnect, incrementReconnect, startBufferPoller],
  );

  // ─── Load a channel into the audio element ────────────────

  const triggerChannelLoad = useCallback(
    async (channelId: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      const channel = channels.find((c) => c.id === channelId);
      if (!channel) {
        setError(`Channel ${channelId} not found`);
        return;
      }

      if (channel.status === 'offline') {
        setError(`${channel.name} is currently offline`);
        setPlayerState('error');
        return;
      }

      const endpoint = pickBestEndpoint(channel);
      if (!endpoint) {
        setError('No playable stream found for this channel');
        return;
      }

      setError(null);
      setPlayerState('loading');

      // Destroy any existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Fade out current audio
      if (!audio.paused) {
        await fadeOut(audio);
      }

      audio.pause();
      audio.src = '';

      if (endpoint.format === 'hls') {
        // Lazy-load hls.js only when needed
        const HlsModule = await import('hls.js');
        const HlsClass = HlsModule.default;

        if (HlsClass.isSupported()) {
          const hls = new HlsClass({
            lowLatencyMode: true,
            backBufferLength: 10,
            maxBufferLength: 20,
            liveSyncDurationCount: 2,
          });
          hls.attachMedia(audio);
          hls.loadSource(endpoint.url);

          hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
            void playWithFade(audio);
          });

          hls.on(HlsClass.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              setPlayerState('reconnecting');
              incrementReconnect();
              schedulerRef.current.schedule(() => triggerChannelLoad(channelId));
            }
          });

          hlsRef.current = hls;
        } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS (Safari)
          audio.src = endpoint.url;
          void playWithFade(audio);
        }
      } else {
        // Direct Ogg/Opus or MP3 stream
        audio.src = endpoint.url;
        void playWithFade(audio);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channels, setError, setPlayerState, incrementReconnect],
  );

  // ─── Watch activeChannelId changes ────────────────────────

  useEffect(() => {
    if (activeChannelId === null) return;
    void triggerChannelLoad(activeChannelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

  // ─── Attach event listeners on mount ─────────────────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    return attachListeners(audio);
  }, [attachListeners]);

  // ─── Expose control surface ───────────────────────────────

  return {
    play: () => audioRef.current && void playWithFade(audioRef.current),
    pause: () => audioRef.current?.pause(),
  };
}

// ─── Fade helpers ─────────────────────────────────────────────

function fadeOut(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve) => {
    const startVol = audio.volume;
    const steps = 20;
    const stepMs = FADE_DURATION_MS / steps;
    let step = 0;

    const tick = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        clearInterval(tick);
        audio.pause();
        audio.volume = startVol;
        resolve();
      }
    }, stepMs);
  });
}

async function playWithFade(audio: HTMLAudioElement): Promise<void> {
  audio.volume = 0;
  try {
    await audio.play();
  } catch {
    return; // Autoplay blocked — user must interact
  }
  const targetVol = usePlayerStore.getState().isMuted
    ? 0
    : usePlayerStore.getState().volume;

  const steps = 20;
  const stepMs = FADE_DURATION_MS / steps;
  let step = 0;

  const tick = setInterval(() => {
    step++;
    audio.volume = Math.min(targetVol, targetVol * (step / steps));
    if (step >= steps) clearInterval(tick);
  }, stepMs);
}
