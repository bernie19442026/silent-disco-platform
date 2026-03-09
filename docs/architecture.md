# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          VENUE (On-Site)                            │
│                                                                     │
│  FOH Console ──► Audio Interface ──► Streaming Laptop               │
│                                           │                         │
│                              ┌────────────┼────────────┐            │
│                              ▼            ▼            ▼            │
│                           CH 1         CH 2         CH 3/4          │
│                         (Main)        (DJ)       (Stage/Crowd)      │
│                              └────────────┼────────────┘            │
│                                           ▼                         │
│                                    FFmpeg Encoders                  │
│                               (Opus 128kbps + MP3 fallback)        │
│                                           │                         │
│                          RTMP push  OR  direct Icecast push         │
└───────────────────────────────────────────┼─────────────────────────┘
                                            │
                                    Internet (WAN)
                                            │
┌───────────────────────────────────────────▼─────────────────────────┐
│                     CLOUD STREAMING LAYER                           │
│                   (Fly.io / DigitalOcean / AWS)                     │
│                                                                     │
│  ┌─────────────────┐    ┌──────────────────┐   ┌─────────────────┐  │
│  │  NGINX-RTMP     │    │  Icecast2        │   │  API Service    │  │
│  │  (Port 1935)    │───►│  (Port 8000)     │◄──│  (Port 3001)    │  │
│  │  RTMP ingest    │    │  Ogg/Opus + MP3  │   │  Node.js/Express│  │
│  │  HLS packaging  │    │  15k listeners   │   │  SSE health     │  │
│  │  (Port 8080)    │    │  /channel1-4.ogg │   │  analytics      │  │
│  └─────────────────┘    └──────────────────┘   └─────────────────┘  │
│                                  │                                   │
│                         ┌────────┴────────┐                         │
│                         │  FFmpeg Workers  │                         │
│                         │  (4 channels)    │                         │
│                         │  Opus encoding   │                         │
│                         └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                              CDN Edge Layer
                         (Cloudflare / BunnyCDN)
                                    │
┌───────────────────────────────────▼─────────────────────────────────┐
│                       VERCEL EDGE (Web Layer)                        │
│                                                                     │
│   Next.js 14 App Router                                             │
│   ├── / (page.tsx)         — Mobile-first player UI                 │
│   ├── /api/channels        — Channel config + listener counts       │
│   ├── /api/events          — Event configuration                    │
│   ├── /api/health          — Infrastructure health check            │
│   ├── /api/analytics       — Analytics ingestion                    │
│   └── /api/stream-status   — SSE listener/health feed               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
                  Android/Chrome            iOS/Safari
                  Ogg/Opus direct           HLS/AAC via
                  from Icecast              hls.js or native
                  (~2-3s latency)           (~5-8s latency)
```

## Technology Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Web frontend | Next.js 14 (App Router) | Server components, ISR, edge runtime |
| Web hosting | Vercel | Global CDN, zero-config deploy |
| State management | Zustand | Minimal, no boilerplate |
| Audio playback | HTML5 Audio + hls.js | Native Opus; hls.js for iOS fallback |
| Primary codec | Opus (Ogg container) | Lowest latency, best quality/bitrate |
| Fallback codec | AAC (HLS) + MP3 | iOS Safari, legacy browsers |
| Streaming server | Icecast2 | Proven, handles 10k+ concurrent streams |
| RTMP ingest | NGINX-RTMP | Accept push from venue encoder |
| Encoding | FFmpeg | Industry standard, multi-codec |
| API | Express.js + TypeScript | Lightweight, easy to deploy |
| Real-time | Server-Sent Events | Works through Vercel edge |
| Infrastructure | Docker + Terraform | Reproducible deploys |
| Cloud | DigitalOcean / Fly.io | Cost-effective persistent servers |

## Audio Delivery Strategy

### Primary: Ogg/Opus (Chrome, Firefox, Edge, Android)
```
Icecast:8000/channel1.ogg → HTML5 Audio → ~2-3s latency
```
- Full browser support except Safari
- 128kbps Opus ≈ 16 KB/s per listener
- At 10k listeners: ~160 MB/s per channel → CDN essential

### Fallback: HLS/AAC (Safari, iOS)
```
NGINX:8080/hls/channel1/index.m3u8 → hls.js → ~5-8s latency
```
- 1-second segments, 3-segment window
- Detected automatically via `audio.canPlayType()`

## Scaling Architecture

### 10,000 Listeners (Single Server)
- Icecast single instance handles up to 15k connections
- Required bandwidth: ~160 MB/s per channel (4 channels = 640 MB/s)
- Required server: 4 vCPU / 8 GB RAM (DO s-4vcpu-8gb, ~$48/mo)

### 50,000+ Listeners (CDN + Relay)
```
Icecast (origin) ──► Icecast Relay 1 ──► Listeners
                 └──► Icecast Relay 2 ──► Listeners
                 └──► Icecast Relay 3 ──► Listeners
```
Or use Cloudflare R2 / BunnyCDN to cache the HLS segments.

### 100,000+ Listeners (CDN-Only Mode)
Switch delivery to HLS-only mode via CDN:
```
FFmpeg → NGINX-RTMP → HLS segments → BunnyCDN → Listeners
```
CDN caches segments, streams scale infinitely.

## Latency Budget

| Stage | Latency |
|-------|---------|
| Mixer → Audio Interface | <1 ms |
| Audio Interface → FFmpeg | 10-50 ms |
| FFmpeg encoding | 20-40 ms |
| Network to Icecast | 10-100 ms |
| Icecast buffering | 500 ms |
| Browser buffering | 1-2 s |
| **Total (Ogg/Opus)** | **~2-3 s** |
| **Total (HLS)** | **~5-8 s** |
