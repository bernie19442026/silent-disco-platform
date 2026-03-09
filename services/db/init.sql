-- Silent Disco Platform — Database Schema
-- PostgreSQL 16

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50)  UNIQUE NOT NULL,
  password_hash TEXT       NOT NULL,
  role        VARCHAR(20)  NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channels (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(50)  UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  color       VARCHAR(7)   NOT NULL DEFAULT '#6366f1',
  emoji       VARCHAR(10),
  status      VARCHAR(20)  NOT NULL DEFAULT 'offline',
  source_type VARCHAR(20)  NOT NULL DEFAULT 'icecast',
  source_url  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stream_sources (
  id          SERIAL PRIMARY KEY,
  channel_id  INTEGER      NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  format      VARCHAR(20)  NOT NULL,  -- ogg, hls, webrtc, mp3
  url         TEXT         NOT NULL,
  codec       VARCHAR(20),
  bitrate     INTEGER,
  priority    INTEGER      NOT NULL DEFAULT 1,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uploads (
  id          SERIAL PRIMARY KEY,
  channel_id  INTEGER      REFERENCES channels(id) ON DELETE SET NULL,
  filename    VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  file_size   BIGINT,
  mime_type   VARCHAR(100),
  url         TEXT         NOT NULL,
  uploaded_by VARCHAR(50),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listeners (
  id          SERIAL PRIMARY KEY,
  session_id  VARCHAR(100) NOT NULL,
  channel_id  INTEGER      REFERENCES channels(id) ON DELETE SET NULL,
  joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  ip_hash     VARCHAR(64),  -- hashed for privacy
  user_agent  TEXT
);

CREATE TABLE IF NOT EXISTS analytics (
  id          SERIAL PRIMARY KEY,
  event_id    VARCHAR(100) NOT NULL,
  session_id  VARCHAR(100) NOT NULL,
  channel_id  INTEGER,
  action      VARCHAR(50)  NOT NULL,  -- join, leave, switch, error
  metadata    JSONB,
  ip_hash     VARCHAR(64),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_event_id ON analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_listeners_session ON listeners(session_id);
CREATE INDEX IF NOT EXISTS idx_listeners_channel ON listeners(channel_id);
CREATE INDEX IF NOT EXISTS idx_stream_sources_channel ON stream_sources(channel_id);

-- Seed default channels
INSERT INTO channels (slug, name, description, color, emoji, status, source_type, source_url)
VALUES
  ('channel1', 'Main Stage',      'Full front-of-house mix',        '#6366f1', '🎵', 'live',    'icecast', '/channel1.ogg'),
  ('channel2', 'DJ Stage',        'Direct DJ monitor feed',         '#ec4899', '🎛️', 'live',    'icecast', '/channel2.ogg'),
  ('channel3', 'VIP Mix',         'Stage monitor & instrument mix', '#f59e0b', '🎸', 'offline', 'icecast', '/channel3.ogg'),
  ('channel4', 'Crowd Ambience',  'Ambient crowd & atmosphere',     '#10b981', '🌊', 'offline', 'icecast', '/channel4.ogg')
ON CONFLICT (slug) DO NOTHING;

-- Seed default admin user (password: "password")
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin')
ON CONFLICT (username) DO NOTHING;
