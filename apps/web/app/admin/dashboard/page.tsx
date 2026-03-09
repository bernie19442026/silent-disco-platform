'use client';

/**
 * Signal Disco — Admin Dashboard
 *
 * Tabbed interface covering:
 *   Overview   — live metrics & system health
 *   Channels   — per-channel source configuration with test/preview
 *   Ingest     — copy-ready FFmpeg / OBS commands per channel
 *   Settings   — event meta, danger zone
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceType = 'icecast' | 'hls' | 'webrtc' | 'file' | 'external';
type ChannelStatus = 'live' | 'offline' | 'degraded' | 'starting';

interface AdminChannel {
  id: number;
  slug: string;
  name: string;
  description: string;
  color: string;
  emoji: string;
  status: ChannelStatus;
  sourceType: SourceType;
  sourceUrl: string;
  uploadedFile?: string;
  listenerCount: number;
  updatedAt: string;
}

interface Metrics {
  totalListeners: number;
  channelCounts: Record<number, number>;
  analyticsEventsCount: number;
  uptime: number;
}

interface TestResult {
  reachable: boolean;
  latencyMs: number | null;
  httpStatus: number | null;
  contentType: string | null;
  error: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_TYPES: { value: SourceType; label: string; description: string }[] = [
  {
    value: 'icecast',
    label: 'Icecast',
    description: 'Direct Icecast/Shoutcast mount — lowest latency (2–3 s)',
  },
  {
    value: 'hls',
    label: 'HLS Stream',
    description: 'HTTP Live Streaming (.m3u8) — works on all iOS/Safari',
  },
  {
    value: 'webrtc',
    label: 'WebRTC',
    description: 'Sub-second latency via WebRTC signaling server',
  },
  {
    value: 'file',
    label: 'Audio File',
    description: 'Upload an MP3/OGG/WAV and loop it on the channel',
  },
  {
    value: 'external',
    label: 'External URL',
    description: 'Any public HTTP audio URL (SHOUTcast, Radionomy, etc.)',
  },
];

const STATUS_OPTIONS: { value: ChannelStatus; label: string; dot: string }[] = [
  { value: 'live',     label: 'Live',     dot: 'bg-green-400' },
  { value: 'starting', label: 'Starting', dot: 'bg-yellow-400' },
  { value: 'degraded', label: 'Degraded', dot: 'bg-orange-400' },
  { value: 'offline',  label: 'Offline',  dot: 'bg-white/20'  },
];

const EMOJI_PRESETS = ['🎵','🎛️','🎸','🌊','🎺','🥁','🎹','🎤','🔊','📻','🎷','🎻','🎶','🎙️','⚡','🔥'];

const COLOR_PRESETS = [
  '#6366f1','#ec4899','#f59e0b','#10b981',
  '#3b82f6','#a855f7','#ef4444','#14b8a6',
  '#f97316','#84cc16','#06b6d4','#8b5cf6',
];

const TABS = ['Overview', 'Channels', 'Ingest', 'Settings'] as const;
type Tab = typeof TABS[number];

// ─── Utility helpers ──────────────────────────────────────────────────────────

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function statusDot(status: ChannelStatus) {
  const map: Record<ChannelStatus, string> = {
    live: 'bg-green-400 shadow-green-400/50',
    starting: 'bg-yellow-400',
    degraded: 'bg-orange-400',
    offline: 'bg-white/20',
  };
  return map[status];
}

function cl(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-white/40 text-xs mt-1">{label}</div>
    </div>
  );
}

function HealthRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean | null;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-white/60 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-white/30 text-xs">{detail}</span>}
        <span
          className={cl(
            'w-2 h-2 rounded-full',
            ok === null ? 'bg-white/20 animate-pulse' : ok ? 'bg-green-400' : 'bg-red-400',
          )}
        />
      </div>
    </div>
  );
}

/** Inline code block with a one-click copy button */
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <div className="relative group">
      <pre className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed pr-14">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition opacity-0 group-hover:opacity-100"
      >
        {copied ? '✓' : 'copy'}
      </button>
    </div>
  );
}

// ─── Source configuration panels ──────────────────────────────────────────────

interface SourcePanelProps {
  form: AdminChannel;
  set: (patch: Partial<AdminChannel>) => void;
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  uploadProgress: number;
}

function IcecastPanel({ form, set }: SourcePanelProps) {
  // Parse existing sourceUrl into host / port / mount components
  const parsed = (() => {
    try {
      const u = new URL(form.sourceUrl.startsWith('http') ? form.sourceUrl : `http://${form.sourceUrl}`);
      return { host: u.hostname, port: u.port || '8000', mount: u.pathname || '/live.ogg' };
    } catch {
      return { host: 'localhost', port: '8000', mount: '/live.ogg' };
    }
  })();

  const [host, setHost] = useState(parsed.host);
  const [port, setPort] = useState(parsed.port);
  const [mount, setMount] = useState(parsed.mount);
  const [codec, setCodec] = useState<'opus' | 'mp3'>('opus');

  // Rebuild sourceUrl whenever components change
  useEffect(() => {
    const m = mount.startsWith('/') ? mount : `/${mount}`;
    set({ sourceUrl: `http://${host}:${port}${m}` });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, port, mount]);

  const field = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-white/50 text-xs mb-1 block">Server hostname / IP</label>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className={field}
            placeholder="stream.example.com"
          />
        </div>
        <div>
          <label className="text-white/50 text-xs mb-1 block">Port</label>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className={field}
            placeholder="8000"
          />
        </div>
      </div>

      <div>
        <label className="text-white/50 text-xs mb-1 block">Mount point</label>
        <input
          value={mount}
          onChange={(e) => setMount(e.target.value)}
          className={field}
          placeholder="/channel1.ogg"
        />
        <p className="text-white/25 text-xs mt-1">
          e.g. <code className="text-white/40">/channel1.ogg</code> — must match the FFmpeg ingest target
        </p>
      </div>

      <div>
        <label className="text-white/50 text-xs mb-1 block">Codec</label>
        <div className="flex gap-2">
          {(['opus', 'mp3'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCodec(c)}
              className={cl(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition border',
                codec === c
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-white/5 border-white/15 text-white/50 hover:text-white',
              )}
            >
              {c === 'opus' ? 'Opus / OGG' : 'MP3'}
            </button>
          ))}
        </div>
        <p className="text-white/25 text-xs mt-1">
          Opus is preferred: lower latency, better quality at same bitrate
        </p>
      </div>

      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2.5 text-xs text-indigo-300">
        Resolved URL: <code className="text-white/70">{form.sourceUrl}</code>
      </div>
    </div>
  );
}

function HlsPanel({ form, set }: SourcePanelProps) {
  const field = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition';

  return (
    <div className="space-y-3">
      <div>
        <label className="text-white/50 text-xs mb-1 block">Playlist URL (.m3u8)</label>
        <input
          value={form.sourceUrl}
          onChange={(e) => set({ sourceUrl: e.target.value })}
          className={field}
          placeholder="https://stream.example.com/channel1/index.m3u8"
        />
        <p className="text-white/25 text-xs mt-1">
          Must be a valid HLS manifest. CORS headers are required for browser playback.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-white/50 text-xs mb-1 block">Latency mode</label>
          <select
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            defaultValue="normal"
          >
            <option value="low" className="bg-gray-900">Low-latency HLS (LHLS)</option>
            <option value="normal" className="bg-gray-900">Normal (3–8 s)</option>
          </select>
        </div>
        <div>
          <label className="text-white/50 text-xs mb-1 block">Start position</label>
          <select
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            defaultValue="live"
          >
            <option value="live" className="bg-gray-900">Live edge</option>
            <option value="start" className="bg-gray-900">Beginning (VOD)</option>
          </select>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 text-xs text-amber-300">
        HLS is used automatically as fallback for iOS/Safari when Icecast is primary.
      </div>
    </div>
  );
}

function WebRtcPanel({ form, set }: SourcePanelProps) {
  const field = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition';

  return (
    <div className="space-y-3">
      <div>
        <label className="text-white/50 text-xs mb-1 block">Signaling server URL</label>
        <input
          value={form.sourceUrl}
          onChange={(e) => set({ sourceUrl: e.target.value })}
          className={field}
          placeholder="wss://signal.example.com/room/channel1"
        />
        <p className="text-white/25 text-xs mt-1">
          Must start with <code className="text-white/40">wss://</code> for production.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-white/50 text-xs mb-1 block">STUN server</label>
          <input
            defaultValue="stun:stun.l.google.com:19302"
            className={field}
            placeholder="stun:stun.l.google.com:19302"
          />
        </div>
        <div>
          <label className="text-white/50 text-xs mb-1 block">TURN server (optional)</label>
          <input
            className={field}
            placeholder="turn:turn.example.com:3478"
          />
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2.5 text-xs text-blue-300">
        WebRTC enables &lt;200 ms latency. Requires a compatible SFU (e.g. mediasoup, LiveKit, Janus).
      </div>
    </div>
  );
}

function FilePanel({ form, set, onUpload, uploading, uploadProgress }: SourcePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) onUpload(file);
        }}
        className="border-2 border-dashed border-white/20 hover:border-indigo-500/50 rounded-xl p-6 text-center cursor-pointer transition"
      >
        <div className="text-2xl mb-2">🎵</div>
        <div className="text-white/60 text-sm">
          {uploading ? 'Uploading…' : 'Drop audio file or click to browse'}
        </div>
        <div className="text-white/30 text-xs mt-1">MP3 · OGG · WAV · AAC · FLAC · WebM · up to 500 MB</div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />
      </div>

      {/* Upload progress */}
      {uploading && (
        <div>
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>Uploading</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Current file */}
      {form.uploadedFile && (
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
          <span className="text-lg">🎵</span>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm truncate">{form.uploadedFile}</div>
            <div className="text-white/40 text-xs">{form.sourceUrl}</div>
          </div>
          <button
            onClick={() => set({ sourceUrl: form.sourceUrl })}
            className="text-xs text-white/40 hover:text-white transition"
          >
            ▶
          </button>
        </div>
      )}

      <div>
        <label className="text-white/50 text-xs mb-1 block">Or enter file URL manually</label>
        <input
          value={form.sourceUrl}
          onChange={(e) => set({ sourceUrl: e.target.value })}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
          placeholder="/uploads/my-track.mp3"
        />
      </div>
    </div>
  );
}

function ExternalPanel({ form, set }: SourcePanelProps) {
  const field = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition';

  return (
    <div className="space-y-3">
      <div>
        <label className="text-white/50 text-xs mb-1 block">Stream URL</label>
        <input
          value={form.sourceUrl}
          onChange={(e) => set({ sourceUrl: e.target.value })}
          className={field}
          placeholder="https://stream.example.com/live.mp3"
        />
        <p className="text-white/25 text-xs mt-1">
          Public HTTP/HTTPS audio stream. Server must send CORS headers for browser playback.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-white/50 text-xs mb-1 block">Format hint</label>
          <select className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
            <option value="" className="bg-gray-900">Auto-detect</option>
            <option value="mp3" className="bg-gray-900">MP3</option>
            <option value="ogg" className="bg-gray-900">OGG/Opus</option>
            <option value="aac" className="bg-gray-900">AAC</option>
            <option value="hls" className="bg-gray-900">HLS (.m3u8)</option>
          </select>
        </div>
        <div>
          <label className="text-white/50 text-xs mb-1 block">Reconnect</label>
          <select className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
            <option value="auto" className="bg-gray-900">Auto (exponential backoff)</option>
            <option value="off" className="bg-gray-900">Off</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Channel editor card ───────────────────────────────────────────────────────

function ChannelEditor({
  channel,
  onUpdate,
}: {
  channel: AdminChannel;
  onUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<AdminChannel>(channel);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [flash, setFlash] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const set = useCallback((patch: Partial<AdminChannel>) => {
    setForm((f) => ({ ...f, ...patch }));
    setTestResult(null); // clear stale test when form changes
  }, []);

  async function save() {
    setSaving(true);
    setFlash(null);
    try {
      const res = await fetch('/api/admin/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setFlash({ type: 'ok', msg: 'Changes saved' });
        setExpanded(false);
        onUpdate();
      } else {
        setFlash({ type: 'err', msg: data.error ?? 'Save failed' });
      }
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/test-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.sourceUrl, type: form.sourceType }),
      });
      const data = (await res.json()) as { ok: boolean; data: TestResult };
      if (data.ok) setTestResult(data.data);
    } finally {
      setTesting(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadProgress(0);
    setFlash(null);

    try {
      // Use XHR for progress tracking (fetch has no upload progress API)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const fd = new FormData();
        fd.append('file', file);
        fd.append('channelId', String(channel.id));

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          try {
            const json = JSON.parse(xhr.responseText) as {
              ok: boolean;
              data?: { url: string; filename: string };
              error?: string;
            };
            if (json.ok && json.data) {
              set({ sourceType: 'file', sourceUrl: json.data.url, uploadedFile: json.data.filename });
              setFlash({ type: 'ok', msg: `Uploaded: ${json.data.filename}` });
              resolve();
            } else {
              setFlash({ type: 'err', msg: json.error ?? 'Upload failed' });
              reject(new Error(json.error));
            }
          } catch {
            reject(new Error('Invalid server response'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.open('POST', '/api/upload');
        xhr.send(fd);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setFlash({ type: 'err', msg });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  const sourcePanelProps: SourcePanelProps = {
    form,
    set,
    onUpload: handleUpload,
    uploading,
    uploadProgress,
  };

  const sourceLabel = SOURCE_TYPES.find((s) => s.value === form.sourceType)?.label ?? form.sourceType;
  const statusCfg = STATUS_OPTIONS.find((s) => s.value === channel.status)!;

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
      {/* ── Card header ── */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Emoji */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl cursor-pointer flex-shrink-0 border border-white/10 hover:border-white/30 transition"
          style={{ backgroundColor: `${channel.color}22` }}
          onClick={() => {
            if (expanded) {
              setShowEmojiPicker((v) => !v);
              setShowColorPicker(false);
            }
          }}
          title={expanded ? 'Change emoji' : undefined}
        >
          {form.emoji}
        </div>

        {/* Channel info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">{channel.name}</span>
            <span className={cl('w-1.5 h-1.5 rounded-full flex-shrink-0', statusDot(channel.status))} />
            <span className="text-white/30 text-xs">{statusCfg.label}</span>
          </div>
          <div className="text-white/35 text-xs truncate mt-0.5">
            {sourceLabel} · <span className="font-mono">{channel.sourceUrl}</span>
          </div>
        </div>

        {/* Listener count */}
        <div className="text-right flex-shrink-0">
          <div className="text-white font-bold text-sm">{channel.listenerCount}</div>
          <div className="text-white/30 text-xs">listeners</div>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => {
            setExpanded((v) => !v);
            setShowEmojiPicker(false);
            setShowColorPicker(false);
            setTestResult(null);
            setFlash(null);
          }}
          className={cl(
            'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition',
            expanded
              ? 'bg-white/10 border-white/20 text-white'
              : 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/40',
          )}
        >
          {expanded ? 'Close' : 'Configure'}
        </button>
      </div>

      {/* ── Expanded editor ── */}
      {expanded && (
        <div className="border-t border-white/10 px-5 py-5 space-y-5">

          {/* ── Identity row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-white/50 text-xs mb-1 block">Channel name</label>
              <input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="text-white/50 text-xs mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={(e) => set({ status: e.target.value as ChannelStatus })}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-gray-900">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-white/50 text-xs mb-1 block">Emoji</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPicker((v) => !v);
                    setShowColorPicker(false);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-lg text-center hover:bg-white/15 transition"
                >
                  {form.emoji}
                </button>
                {showEmojiPicker && (
                  <div className="absolute z-10 top-10 left-0 bg-[#13141c] border border-white/15 rounded-xl p-2 grid grid-cols-8 gap-1 shadow-xl">
                    {EMOJI_PRESETS.map((e) => (
                      <button
                        key={e}
                        onClick={() => { set({ emoji: e }); setShowEmojiPicker(false); }}
                        className="text-lg w-8 h-8 rounded hover:bg-white/10 transition"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Description + color ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-white/50 text-xs mb-1 block">Description</label>
              <input
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                placeholder="Short description shown to listeners"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Accent color</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowColorPicker((v) => !v); setShowEmojiPicker(false); }}
                  className="w-full h-9 rounded-lg border border-white/20 transition hover:border-white/40"
                  style={{ backgroundColor: form.color }}
                />
                {showColorPicker && (
                  <div className="absolute z-10 top-10 right-0 bg-[#13141c] border border-white/15 rounded-xl p-2 grid grid-cols-6 gap-1.5 shadow-xl">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => { set({ color: c }); setShowColorPicker(false); }}
                        className="w-7 h-7 rounded-md border-2 transition hover:scale-110"
                        style={{
                          backgroundColor: c,
                          borderColor: form.color === c ? 'white' : 'transparent',
                        }}
                      />
                    ))}
                    <div className="col-span-6 mt-1">
                      <input
                        type="color"
                        value={form.color}
                        onChange={(e) => set({ color: e.target.value })}
                        className="w-full h-7 rounded cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Source type selector ── */}
          <div>
            <label className="text-white/50 text-xs mb-2 block uppercase tracking-wider">
              Audio Source
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SOURCE_TYPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set({ sourceType: s.value })}
                  className={cl(
                    'flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-center transition',
                    form.sourceType === s.value
                      ? 'border-indigo-500 bg-indigo-600/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/25',
                  )}
                >
                  <span className="text-lg">
                    {s.value === 'icecast' ? '🎙️'
                      : s.value === 'hls' ? '📡'
                      : s.value === 'webrtc' ? '⚡'
                      : s.value === 'file' ? '📁'
                      : '🔗'}
                  </span>
                  <span className="text-xs font-medium leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
            <p className="text-white/25 text-xs mt-2">
              {SOURCE_TYPES.find((s) => s.value === form.sourceType)?.description}
            </p>
          </div>

          {/* ── Source-specific config panel ── */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            {form.sourceType === 'icecast'  && <IcecastPanel  {...sourcePanelProps} />}
            {form.sourceType === 'hls'      && <HlsPanel      {...sourcePanelProps} />}
            {form.sourceType === 'webrtc'   && <WebRtcPanel   {...sourcePanelProps} />}
            {form.sourceType === 'file'     && <FilePanel     {...sourcePanelProps} />}
            {form.sourceType === 'external' && <ExternalPanel {...sourcePanelProps} />}
          </div>

          {/* ── Test connection ── */}
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={testConnection}
                disabled={testing || !form.sourceUrl}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/15 hover:bg-white/10 disabled:opacity-40 text-sm text-white/70 hover:text-white transition"
              >
                {testing ? (
                  <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <span>⚡</span>
                )}
                {testing ? 'Testing…' : 'Test connection'}
              </button>

              {testResult && (
                <div
                  className={cl(
                    'flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border',
                    testResult.reachable
                      ? 'text-green-400 bg-green-400/10 border-green-400/20'
                      : 'text-red-400 bg-red-400/10 border-red-400/20',
                  )}
                >
                  <span>{testResult.reachable ? '✓' : '✗'}</span>
                  <span>
                    {testResult.reachable
                      ? `Reachable · ${testResult.latencyMs ?? '—'} ms · HTTP ${testResult.httpStatus}`
                      : testResult.error ?? 'Unreachable'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Flash message ── */}
          {flash && (
            <div
              className={cl(
                'text-sm px-4 py-2.5 rounded-lg border',
                flash.type === 'ok'
                  ? 'text-green-400 bg-green-400/10 border-green-400/20'
                  : 'text-red-400 bg-red-400/10 border-red-400/20',
              )}
            >
              {flash.msg}
            </div>
          )}

          {/* ── Action row ── */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => { setForm(channel); setExpanded(false); setFlash(null); setTestResult(null); }}
              className="text-sm text-white/40 hover:text-white transition"
            >
              Discard changes
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-white text-sm font-semibold transition"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({
  channels,
  metrics,
  healthChecking,
}: {
  channels: AdminChannel[];
  metrics: Metrics | null;
  healthChecking: boolean;
}) {
  const liveCount = channels.filter((c) => c.status === 'live').length;

  return (
    <div className="space-y-6">
      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          value={metrics?.totalListeners ?? '—'}
          label="Total Listeners"
          color="text-indigo-400"
        />
        <MetricCard value={liveCount} label="Live Channels" color="text-green-400" />
        <MetricCard
          value={metrics?.analyticsEventsCount ?? '—'}
          label="Analytics Events"
          color="text-pink-400"
        />
        <MetricCard
          value={metrics ? formatUptime(metrics.uptime) : '—'}
          label="Server Uptime"
          color="text-amber-400"
        />
      </div>

      {/* Per-channel listener bars */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white/70 mb-4">Channel activity</h3>
        <div className="space-y-3">
          {channels.map((ch) => {
            const count = metrics?.channelCounts[ch.id] ?? 0;
            const total = metrics?.totalListeners ?? 1;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={ch.id} className="flex items-center gap-3">
                <span className="text-sm w-5 text-center">{ch.emoji}</span>
                <span className="text-white/60 text-xs w-28 truncate">{ch.name}</span>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: ch.color }}
                  />
                </div>
                <span className="text-white/40 text-xs w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* System health */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white/70 mb-3">System health</h3>
        <HealthRow label="Next.js API" ok={!healthChecking} detail="running" />
        <HealthRow label="Channel store" ok={channels.length === 4} detail={`${channels.length} channels`} />
        <HealthRow label="Auth middleware" ok={true} detail="JWT HS256" />
        <HealthRow label="Metrics endpoint" ok={metrics !== null} detail={metrics ? 'ok' : 'loading'} />
        <HealthRow label="Icecast / streaming" ok={null} detail="probe in Ingest tab" />
      </div>

      {/* API quick links */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white/70 mb-3">API endpoints</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Public channels', href: '/api/channels' },
            { label: 'Health check', href: '/api/health' },
            { label: 'Stream status SSE', href: '/api/stream-status' },
            { label: 'Analytics ingest', href: '/api/analytics' },
            { label: 'Prometheus metrics', href: '/api/admin/metrics?format=prometheus' },
            { label: 'Main player', href: '/' },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition border border-white/5"
            >
              <span className="text-white/20">↗</span>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChannelsTab({
  channels,
  loading,
  onUpdate,
}: {
  channels: AdminChannel[];
  loading: boolean;
  onUpdate: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-white/35 text-sm">
        Click <strong className="text-white/60">Configure</strong> on any channel to expand the source editor.
        Changes only take effect after pressing <strong className="text-white/60">Save changes</strong>.
      </p>
      {channels.map((ch) => (
        <ChannelEditor key={ch.id} channel={ch} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function IngestTab({ channels }: { channels: AdminChannel[] }) {
  const [icecastHost, setIcecastHost] = useState('localhost');
  const [icecastPort, setIcecastPort] = useState('8000');
  const [icecastPass, setIcecastPass] = useState('hackme');
  const [rtmpHost, setRtmpHost] = useState('localhost');
  const [bitrate, setBitrate] = useState('128');

  const field = 'bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition w-full';

  return (
    <div className="space-y-6">
      {/* Connection settings */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white/70 mb-4">Streaming server settings</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-white/40 text-xs mb-1 block">Icecast host</label>
            <input value={icecastHost} onChange={(e) => setIcecastHost(e.target.value)} className={field} />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Icecast port</label>
            <input value={icecastPort} onChange={(e) => setIcecastPort(e.target.value)} className={field} />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Source password</label>
            <input
              value={icecastPass}
              onChange={(e) => setIcecastPass(e.target.value)}
              type="password"
              className={field}
            />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Audio bitrate (kbps)</label>
            <input value={bitrate} onChange={(e) => setBitrate(e.target.value)} className={field} />
          </div>
        </div>
      </div>

      {/* Per-channel commands */}
      {channels.map((ch) => (
        <div key={ch.id} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{ch.emoji}</span>
            <span className="font-semibold text-white">{ch.name}</span>
            <span
              className={cl('w-1.5 h-1.5 rounded-full', statusDot(ch.status))}
            />
            <span className="text-white/30 text-xs">{ch.status}</span>
          </div>

          {/* Icecast / Opus */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white/40 text-xs uppercase tracking-widest">Icecast · Opus (recommended)</span>
              <span className="text-xs bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded">~2–3 s latency</span>
            </div>
            <CodeBlock
              code={`ffmpeg -re -f avfoundation -i ":0" \\
  -c:a libopus -b:a ${bitrate}k -vn \\
  -f ogg icecast://source:${icecastPass}@${icecastHost}:${icecastPort}/${ch.slug}.ogg`}
            />
          </div>

          {/* Icecast / MP3 fallback */}
          <div>
            <div className="text-white/40 text-xs uppercase tracking-widest mb-2">Icecast · MP3 (fallback)</div>
            <CodeBlock
              code={`ffmpeg -re -f avfoundation -i ":0" \\
  -c:a libmp3lame -b:a ${bitrate}k -vn \\
  -f mp3 icecast://source:${icecastPass}@${icecastHost}:${icecastPort}/${ch.slug}.mp3`}
            />
          </div>

          {/* RTMP → HLS */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white/40 text-xs uppercase tracking-widest">RTMP → HLS (iOS/Safari fallback)</span>
              <span className="text-xs bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">~5–8 s latency</span>
            </div>
            <CodeBlock
              code={`ffmpeg -re -f avfoundation -i ":0" \\
  -c:a aac -b:a ${bitrate}k -vn \\
  -f flv rtmp://${rtmpHost}:1935/live/${ch.slug}`}
            />
          </div>

          {/* OBS Studio */}
          <div>
            <div className="text-white/40 text-xs uppercase tracking-widest mb-2">OBS Studio · Custom stream</div>
            <div className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-xs text-white/60 space-y-1 font-mono">
              <div><span className="text-white/30">Service:</span> Custom…</div>
              <div><span className="text-white/30">Server:</span> rtmp://{rtmpHost}:1935/live</div>
              <div><span className="text-white/30">Stream key:</span> {ch.slug}</div>
              <div><span className="text-white/30">Audio encoder:</span> AAC · {bitrate} kbps · 44.1 kHz</div>
            </div>
          </div>

          {/* File loop (shown only when sourceType === 'file') */}
          {ch.sourceType === 'file' && ch.sourceUrl && (
            <div>
              <div className="text-white/40 text-xs uppercase tracking-widest mb-2">FFmpeg file loop → Icecast</div>
              <CodeBlock
                code={`ffmpeg -re -stream_loop -1 -i "public${ch.sourceUrl}" \\
  -c:a libopus -b:a ${bitrate}k -vn \\
  -f ogg icecast://source:${icecastPass}@${icecastHost}:${icecastPort}/${ch.slug}.ogg`}
              />
            </div>
          )}
        </div>
      ))}

      {/* RTMP host note */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-3 text-sm text-white/50">
        <span className="text-lg flex-shrink-0">ℹ️</span>
        <div>
          RTMP ingest host is{' '}
          <code className="text-white/70">{rtmpHost}:1935</code>.{' '}
          Change in the field above.{' '}
          Run <code className="text-white/70">docker compose up nginx</code> to start the RTMP→HLS packager.
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [eventName, setEventName] = useState('Signal Disco');
  const [eventVenue, setEventVenue] = useState('');
  const [saved, setSaved] = useState(false);

  const field = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition';

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white/70">Event settings</h3>
        <p className="text-white/30 text-xs">
          These values are read from environment variables at build time.
          Update them in your Vercel project settings and redeploy to apply.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">Event name</label>
            <input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className={field}
              placeholder="Signal Disco"
            />
            <p className="text-white/20 text-xs mt-1">Env: NEXT_PUBLIC_EVENT_NAME</p>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">Venue</label>
            <input
              value={eventVenue}
              onChange={(e) => setEventVenue(e.target.value)}
              className={field}
              placeholder="The Warehouse, London"
            />
            <p className="text-white/20 text-xs mt-1">Env: NEXT_PUBLIC_EVENT_VENUE</p>
          </div>
        </div>

        <button
          onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium transition"
        >
          {saved ? '✓ Noted' : 'Save (requires redeploy)'}
        </button>
      </div>

      {/* Credentials */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white/70">Admin credentials</h3>
        <p className="text-white/30 text-xs">
          Set these environment variables on Vercel to override the defaults.
          Never commit credentials to source control.
        </p>
        <div className="font-mono text-xs space-y-1 text-white/50">
          <div>
            <span className="text-white/30">ADMIN_USERNAME=</span>
            <span className="text-white/60">admin</span>
          </div>
          <div>
            <span className="text-white/30">ADMIN_PASSWORD_HASH=</span>
            <span className="text-white/60">(bcrypt hash of your password)</span>
          </div>
          <div>
            <span className="text-white/30">JWT_SECRET=</span>
            <span className="text-white/60">(32+ random bytes, base64)</span>
          </div>
        </div>
        <p className="text-white/25 text-xs">
          Generate a hash:{' '}
          <code className="text-white/40">
            node -e &quot;require(&apos;bcryptjs&apos;).hash(&apos;yourpassword&apos;,10).then(console.log)&quot;
          </code>
        </p>
      </div>

      {/* Danger zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-red-400">Danger zone</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/60">Reset all channels to defaults</div>
            <div className="text-xs text-white/30">Restores channel names, slugs, and sources to factory settings.</div>
          </div>
          <button
            onClick={() => {
              if (confirm('Reset all channel configuration to defaults?')) {
                // Channel store resets on next API call when globalThis store is cleared
                // (requires server restart / re-deploy for true reset in serverless)
                alert('Channel defaults will restore on next server cold-start.');
              }
            }}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-lg text-red-400 text-sm transition"
          >
            Reset channels
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [metrics, setMetrics]   = useState<Metrics | null>(null);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    try {
      const [chRes, mRes] = await Promise.all([
        fetch('/api/admin/channels'),
        fetch('/api/admin/metrics'),
      ]);
      if (chRes.ok) {
        const d = (await chRes.json()) as { ok: boolean; data: AdminChannel[] };
        if (d.ok) setChannels(d.data);
      }
      if (mRes.ok) {
        const d = (await mRes.json()) as { ok: boolean; data: Metrics };
        if (d.ok) setMetrics(d.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  const totalListeners = metrics?.totalListeners ?? 0;

  return (
    <div className="min-h-screen bg-[#08090e] text-white">

      {/* ── Top header ── */}
      <header className="border-b border-white/10 px-6 py-3 flex items-center justify-between sticky top-0 z-20 bg-[#08090e]/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-xl">📡</span>
          <div>
            <h1 className="font-bold text-base leading-none">Signal Disco</h1>
            <p className="text-white/35 text-xs mt-0.5">Admin Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live pulse */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-white/40">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-green-400/50 shadow" />
            {totalListeners} listening
          </div>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/40 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10"
          >
            ↗ View site
          </a>

          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300 transition px-3 py-1.5 rounded-lg hover:bg-red-400/5"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="border-b border-white/10 px-6 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cl(
              'px-4 py-3 text-sm font-medium border-b-2 transition -mb-px',
              activeTab === tab
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-white/40 hover:text-white',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {activeTab === 'Overview' && (
          <OverviewTab channels={channels} metrics={metrics} healthChecking={loading} />
        )}
        {activeTab === 'Channels' && (
          <ChannelsTab channels={channels} loading={loading} onUpdate={load} />
        )}
        {activeTab === 'Ingest' && (
          <IngestTab channels={channels} />
        )}
        {activeTab === 'Settings' && (
          <SettingsTab />
        )}
      </div>
    </div>
  );
}
