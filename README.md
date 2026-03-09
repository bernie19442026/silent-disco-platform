# Silent Disco Streaming Platform

A production-grade, multi-channel live audio streaming platform for silent disco events and live concerts. Thousands of listeners can tune into one of four audio channels directly in their mobile browser — no app required.

```
┌──────────────────────────────────────┐
│         🎶  SILENT DISCO             │
│         Summer Festival 2025         │
│         ● LIVE  ·  4,281 listening   │
├──────────────┬───────────────────────┤
│ 🎵 CH 1      │  🎛️ CH 2              │
│ Main Mix     │  DJ Booth             │
│ ●●●●●  2341  │  ●●●   891            │
├──────────────┼───────────────────────┤
│ 🎸 CH 3      │  🌊 CH 4              │
│ Stage Feed   │  Crowd Mix            │
│ ●●●●   672   │  ●●     377           │
├──────────────┴───────────────────────┤
│  Volume: ────●─────────      85      │
│  Now playing: Main Mix               │
└──────────────────────────────────────┘
```

## Features

- **4 simultaneous live channels** — switch instantly with smooth crossfade
- **Opus codec** — 128kbps, ~2-3 second latency (best-in-class)
- **iOS/Safari support** — automatic HLS fallback via hls.js
- **10,000+ concurrent listeners** — Icecast + CDN scaling
- **Auto-reconnect** — exponential backoff on stream failure
- **Real-time listener counts** — Server-Sent Events
- **Mobile-first UI** — works great on any phone browser
- **Zero app download** — share a URL or QR code
- **Vercel-ready** — frontend deploys in one command

## Architecture

```
FOH Console → Audio Interface → FFmpeg (Opus) → Icecast → Listeners
                                             └──────────────────────
                                                 NGINX-RTMP (HLS)
                                             └──────────────────────
```

See [docs/architecture.md](docs/architecture.md) for the full diagram.

## Repository Structure

```
silent-disco-platform/
├── apps/
│   └── web/                    # Next.js 14 frontend (Vercel)
│       ├── app/
│       │   ├── page.tsx        # Main player UI
│       │   ├── layout.tsx      # App shell
│       │   └── api/
│       │       ├── channels/   # Channel config API
│       │       ├── events/     # Event config API
│       │       ├── health/     # Infrastructure health
│       │       ├── analytics/  # Event tracking
│       │       └── stream-status/ # SSE listener feed
│       ├── components/
│       │   ├── AudioPlayer.tsx  # Root player component
│       │   ├── ChannelCard.tsx  # Individual channel tile
│       │   ├── VolumeControl.tsx
│       │   ├── LiveIndicator.tsx
│       │   └── EventHeader.tsx
│       ├── hooks/
│       │   ├── useAudioPlayer.ts  # Core audio engine
│       │   └── useStreamHealth.ts # SSE subscription
│       ├── lib/
│       │   ├── types.ts        # Domain types
│       │   ├── streaming.ts    # URL helpers, codec detection
│       │   └── analytics.ts    # Client-side tracking
│       └── store/
│           └── playerStore.ts  # Zustand state
│
├── services/
│   ├── streaming/
│   │   ├── icecast/            # Icecast2 server
│   │   │   ├── Dockerfile
│   │   │   ├── icecast.xml     # Server config (4 channels)
│   │   │   └── entrypoint.sh   # Env var substitution
│   │   ├── rtmp/               # NGINX-RTMP ingest
│   │   │   ├── Dockerfile
│   │   │   └── nginx.conf      # RTMP + HLS config
│   │   └── ffmpeg/             # Encoder workers
│   │       ├── Dockerfile
│   │       ├── encode-channel.sh  # Single channel encoder
│   │       ├── encode-all.sh      # All 4 channels supervisor
│   │       └── supervisord.conf
│   └── api/                    # Standalone Node.js API
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   └── services/
│       │       └── streamMonitor.ts
│       └── Dockerfile
│
├── infra/
│   ├── docker/
│   │   └── web.Dockerfile      # Production Next.js container
│   └── terraform/              # DigitalOcean infrastructure
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── docs/
│   ├── architecture.md         # Full system architecture
│   ├── event-setup.md          # Venue setup walkthrough
│   └── ffmpeg-commands.md      # All FFmpeg pipelines
│
├── docker-compose.yml          # Local development stack
├── .env.example                # Environment variable template
└── README.md
```

## Quick Start (Local Development)

### 1. Clone and configure

```bash
git clone <this-repo> silent-disco-platform
cd silent-disco-platform
cp .env.example .env
# .env defaults work as-is for local dev (test tone mode)
```

### 2. Start the streaming stack

```bash
# Start Icecast + NGINX + FFmpeg test tones + API
docker compose up icecast nginx ffmpeg api

# Wait for health checks (~15 seconds), then verify:
curl http://localhost:8000/status-json.xsl
```

### 3. Start the web frontend

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

You should see 4 channels with sine-wave test tones playing at:
- CH1 — 300 Hz
- CH2 — 440 Hz (concert A)
- CH3 — 528 Hz
- CH4 — 852 Hz

## Deploy to Production

### Frontend → Vercel

```bash
cd apps/web
npx vercel

# Set these env vars in the Vercel dashboard:
# NEXT_PUBLIC_EVENT_ID=your-event
# NEXT_PUBLIC_EVENT_NAME="Your Event Name"
# NEXT_PUBLIC_STREAMING_BASE_URL=http://YOUR_SERVER:8000
# ICECAST_STATS_URL=http://YOUR_SERVER:8000
```

### Streaming Server → DigitalOcean

```bash
cd infra/terraform

# Create terraform.tfvars:
cat > terraform.tfvars <<EOF
ssh_public_key          = "$(cat ~/.ssh/id_rsa.pub)"
icecast_source_password = "your-strong-password"
icecast_admin_password  = "your-admin-password"
event_name              = "Your Event"
EOF

terraform init && terraform apply
# Note the output IPs, add to Vercel env vars
```

### Streaming Server → Docker Compose on VPS

```bash
# On your server:
git clone <this-repo> && cd silent-disco-platform
cp .env.example .env && nano .env   # Set passwords and domain
docker compose up -d icecast nginx api
```

## Encoding from Venue

### Connect your audio interface

```bash
# Find your device
aplay -l

# Update .env:
FFMPEG_INPUT_TYPE=alsa
ALSA_CH1=hw:2,0   # Your interface, input 1
ALSA_CH2=hw:2,1   # Input 2
ALSA_CH3=hw:2,2   # Input 3
ALSA_CH4=hw:2,3   # Input 4

# Start encoding
docker compose up ffmpeg
```

See [docs/ffmpeg-commands.md](docs/ffmpeg-commands.md) for all input modes (ALSA, PulseAudio, JACK, RTMP, test tone).

## Scaling

| Listeners | Setup | Cost estimate |
|-----------|-------|---------------|
| < 1,000 | Single $12/mo VPS | ~$12/mo |
| 1,000–10,000 | $48/mo droplet (4vCPU/8GB) | ~$60/mo |
| 10,000–50,000 | 3× relay servers + CDN | ~$200/mo |
| 50,000+ | CDN-only HLS mode | ~$500/mo |

See [docs/architecture.md](docs/architecture.md) for scaling strategies.

## Health Monitoring

```bash
# Infrastructure health
curl https://your-event.vercel.app/api/health

# Icecast stats (listener counts per channel)
curl http://YOUR_SERVER:8000/status-json.xsl

# Stream status SSE (real-time)
curl -N https://your-event.vercel.app/api/stream-status
```

## Tech Stack

| | |
|--|--|
| **Frontend** | Next.js 14, React, Zustand, Tailwind CSS |
| **Audio** | HTML5 Audio, hls.js (iOS fallback) |
| **Codec** | Opus (primary), AAC/HLS, MP3 (fallback) |
| **Streaming** | Icecast2, NGINX-RTMP |
| **Encoding** | FFmpeg 6.x |
| **API** | Express.js + TypeScript |
| **Infrastructure** | Docker, Terraform, DigitalOcean |
| **Hosting** | Vercel (frontend) + VPS (streaming) |

## License

MIT
