// ─────────────────────────────────────────────────────────────
// Core domain types for the Silent Disco Streaming Platform
// ─────────────────────────────────────────────────────────────

export type CodecType = 'opus' | 'aac' | 'mp3' | 'vorbis' | 'flac';
export type StreamFormat = 'ogg' | 'hls' | 'mp3' | 'webrtc';
export type ChannelStatus = 'live' | 'offline' | 'degraded' | 'starting';
export type PlayerState = 'idle' | 'loading' | 'playing' | 'buffering' | 'error' | 'reconnecting';

export interface StreamEndpoint {
  format: StreamFormat;
  url: string;
  codec: CodecType;
  bitrate: number; // kbps
  latencyMs?: number;
  priority: number; // lower = higher priority
}

export interface Channel {
  id: number;
  slug: string;           // e.g. "channel1"
  name: string;           // e.g. "Main Mix"
  description?: string;
  color: string;          // hex colour for UI
  emoji?: string;
  status: ChannelStatus;
  listenerCount: number;
  endpoints: StreamEndpoint[];
  metadata?: TrackMetadata;
}

export interface TrackMetadata {
  artist?: string;
  title?: string;
  album?: string;
  artworkUrl?: string;
  updatedAt: string;      // ISO timestamp
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  venue?: string;
  date?: string;          // ISO date
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  channels: Channel[];
  isLive: boolean;
  totalListeners: number;
  startedAt?: string;
  endsAt?: string;
}

export interface StreamHealth {
  channelSlug: string;
  status: ChannelStatus;
  latencyMs: number;
  bitrate: number;
  bufferHealth: number;   // 0-1
  reconnectCount: number;
  lastChecked: string;
}

export interface PlayerStateSlice {
  state: PlayerState;
  activeChannelId: number | null;
  volume: number;         // 0-1
  isMuted: boolean;
  latencyMs: number;
  bufferHealth: number;   // 0-1
  reconnectCount: number;
  error: string | null;
}

export interface AnalyticsEvent {
  eventId: string;
  channelId: number;
  sessionId: string;
  action: 'join' | 'leave' | 'switch' | 'pause' | 'resume' | 'error';
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// API response wrappers
export interface ApiResponse<T> {
  data: T;
  ok: true;
}
export interface ApiError {
  error: string;
  code: string;
  ok: false;
}
export type ApiResult<T> = ApiResponse<T> | ApiError;

// Health check response from streaming server
export interface IcecastStats {
  icestats: {
    admin: string;
    host: string;
    location: string;
    server_start: string;
    source: IcecastSource[];
  };
}

export interface IcecastSource {
  listenurl: string;
  listeners: number;
  stream_start: string;
  title?: string;
  bitrate?: number;
  audio_info?: string;
}
