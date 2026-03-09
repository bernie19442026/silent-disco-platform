// /Users/bernie/silent-disco-platform/apps/web/app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface AdminChannel {
  id: number;
  slug: string;
  name: string;
  description: string;
  color: string;
  emoji: string;
  status: 'live' | 'offline' | 'degraded' | 'starting';
  sourceType: 'icecast' | 'hls' | 'webrtc' | 'file' | 'external';
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

const SOURCE_TYPES = [
  { value: 'icecast', label: '🎙️ Icecast Stream' },
  { value: 'hls', label: '📡 HLS Stream URL' },
  { value: 'webrtc', label: '⚡ WebRTC' },
  { value: 'file', label: '📁 Uploaded Audio File' },
  { value: 'external', label: '🔗 External URL' },
];

const STATUS_OPTIONS = [
  { value: 'live', label: '🔴 Live' },
  { value: 'offline', label: '⚫ Offline' },
  { value: 'starting', label: '🟡 Starting' },
  { value: 'degraded', label: '🟠 Degraded' },
];

function ChannelEditor({ channel, onUpdate }: { channel: AdminChannel; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(channel);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        setMsg('✓ Saved');
        setEditing(false);
        onUpdate();
      } else {
        setMsg(`Error: ${data.error}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('channelId', String(channel.id));
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json() as { ok: boolean; data?: { url: string }; error?: string };
      if (data.ok && data.data) {
        setForm((f) => ({ ...f, sourceType: 'file', sourceUrl: data.data!.url }));
        setMsg(`✓ Uploaded: ${data.data.url}`);
      } else {
        setMsg(`Upload error: ${data.error}`);
      }
    } finally {
      setUploading(false);
    }
  }

  const statusColor = {
    live: 'text-green-400',
    offline: 'text-white/40',
    starting: 'text-yellow-400',
    degraded: 'text-orange-400',
  }[channel.status];

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{channel.emoji}</span>
          <div>
            <div className="font-semibold text-white">{channel.name}</div>
            <div className={`text-xs ${statusColor}`}>
              {channel.status.toUpperCase()} · {channel.listenerCount} listeners
            </div>
          </div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {!editing && (
        <div className="text-white/40 text-xs space-y-1">
          <div>Source: {channel.sourceType} — {channel.sourceUrl}</div>
          <div>Updated: {new Date(channel.updatedAt).toLocaleString()}</div>
        </div>
      )}

      {editing && (
        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">Channel Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AdminChannel['status'] }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">Source Type</label>
            <select
              value={form.sourceType}
              onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value as AdminChannel['sourceType'] }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              {SOURCE_TYPES.map((o) => (
                <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
              ))}
            </select>
          </div>

          {form.sourceType !== 'file' && (
            <div>
              <label className="text-white/50 text-xs mb-1 block">Stream URL</label>
              <input
                value={form.sourceUrl}
                onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="http://..."
              />
            </div>
          )}

          {form.sourceType === 'file' && (
            <div>
              <label className="text-white/50 text-xs mb-1 block">Upload Audio File</label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="w-full text-white/60 text-sm file:mr-3 file:bg-indigo-600 file:border-0 file:text-white file:text-xs file:px-3 file:py-1.5 file:rounded-md file:cursor-pointer"
              />
              {form.uploadedFile && (
                <div className="text-white/40 text-xs mt-1">Current: {form.uploadedFile}</div>
              )}
            </div>
          )}

          {msg && (
            <div className={`text-xs px-3 py-2 rounded-lg ${msg.startsWith('✓') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
              {msg}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || uploading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [chRes, mRes] = await Promise.all([
        fetch('/api/admin/channels'),
        fetch('/api/admin/metrics'),
      ]);
      if (chRes.ok) {
        const d = await chRes.json() as { ok: boolean; data: AdminChannel[] };
        if (d.ok) setChannels(d.data);
      }
      if (mRes.ok) {
        const d = await mRes.json() as { ok: boolean; data: Metrics };
        if (d.ok) setMetrics(d.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  function formatUptime(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }

  return (
    <div className="min-h-screen bg-[#08090e] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎧</span>
          <div>
            <h1 className="font-bold text-lg">Admin Dashboard</h1>
            <p className="text-white/40 text-xs">Silent Disco Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" target="_blank" className="text-white/40 hover:text-white text-sm transition">
            ↗ View Site
          </a>
          <button
            onClick={handleLogout}
            className="text-sm text-red-400 hover:text-red-300 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Metrics cards */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-indigo-400">{metrics.totalListeners}</div>
              <div className="text-white/40 text-xs mt-1">Total Listeners</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-400">
                {channels.filter((c) => c.status === 'live').length}
              </div>
              <div className="text-white/40 text-xs mt-1">Live Channels</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-pink-400">{metrics.analyticsEventsCount}</div>
              <div className="text-white/40 text-xs mt-1">Analytics Events</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-400">{formatUptime(metrics.uptime)}</div>
              <div className="text-white/40 text-xs mt-1">Uptime</div>
            </div>
          </div>
        )}

        {/* Channel management */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Channels</h2>
          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {channels.map((ch) => (
                <ChannelEditor key={ch.id} channel={ch} onUpdate={load} />
              ))}
            </div>
          )}
        </section>

        {/* Quick links */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'API Health', href: '/api/health', icon: '💚' },
              { label: 'Channel Config', href: '/api/channels', icon: '📻' },
              { label: 'Prometheus Metrics', href: '/api/admin/metrics?format=prometheus', icon: '📊' },
              { label: 'Stream Status SSE', href: '/api/stream-status', icon: '📡' },
              { label: 'Analytics', href: '/api/analytics', icon: '📈' },
              { label: 'Main Player', href: '/', icon: '🎵' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm transition"
              >
                <span>{link.icon}</span>
                <span className="text-white/70">{link.label}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Streaming setup info */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-3">Stream Ingest</h2>
          <div className="space-y-2 text-sm text-white/60">
            <div>
              <span className="text-white/40 text-xs uppercase tracking-widest">Icecast</span>
              <code className="block mt-1 bg-black/30 rounded px-3 py-1.5 text-green-400 text-xs">
                ffmpeg -re -i input.mp3 -c:a libopus -b:a 128k -f ogg icecast://source:hackme@localhost:8000/channel1.ogg
              </code>
            </div>
            <div>
              <span className="text-white/40 text-xs uppercase tracking-widest">RTMP/HLS</span>
              <code className="block mt-1 bg-black/30 rounded px-3 py-1.5 text-green-400 text-xs">
                ffmpeg -re -i input.mp3 -c:a aac -b:a 128k -f flv rtmp://localhost:1935/live/channel1
              </code>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
