/**
 * Global player state managed with Zustand.
 * Audio engine (HTMLAudioElement / HLS.js) lives in useAudioPlayer — NOT here.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { PlayerState } from '../lib/types';

interface PlayerStore {
  // Playback
  activeChannelId: number | null;
  playerState: PlayerState;
  volume: number;       // 0–1
  isMuted: boolean;

  // Quality / latency telemetry
  latencyMs: number;
  bufferHealth: number; // 0–1
  reconnectCount: number;
  error: string | null;

  // Channel listener counts (updated via SSE)
  listenerCounts: Record<number, number>;

  // Actions
  setActiveChannel: (id: number) => void;
  setPlayerState: (state: PlayerState) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setLatency: (ms: number) => void;
  setBufferHealth: (h: number) => void;
  incrementReconnect: () => void;
  resetReconnect: () => void;
  setError: (msg: string | null) => void;
  updateListenerCount: (channelId: number, count: number) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector((set) => ({
    activeChannelId: null,
    playerState: 'idle',
    volume: 0.85,
    isMuted: false,
    latencyMs: 0,
    bufferHealth: 1,
    reconnectCount: 0,
    error: null,
    listenerCounts: {},

    setActiveChannel: (id) =>
      set({ activeChannelId: id, error: null, playerState: 'loading' }),

    setPlayerState: (state) => set({ playerState: state }),

    setVolume: (v) =>
      set({ volume: Math.max(0, Math.min(1, v)), isMuted: v === 0 }),

    toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),

    setLatency: (ms) => set({ latencyMs: ms }),

    setBufferHealth: (h) => set({ bufferHealth: h }),

    incrementReconnect: () =>
      set((s) => ({ reconnectCount: s.reconnectCount + 1 })),

    resetReconnect: () => set({ reconnectCount: 0 }),

    setError: (msg) =>
      set({ error: msg, playerState: msg ? 'error' : 'idle' }),

    updateListenerCount: (channelId, count) =>
      set((s) => ({
        listenerCounts: { ...s.listenerCounts, [channelId]: count },
      })),
  })),
);
