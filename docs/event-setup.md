# Event Setup Walkthrough

## Real-World Signal Chain

```
FOH Mixing Console
        │
        ▼ (XLR / TRS aux sends)
  Audio Interface
  (Focusrite Scarlett 4i4 / Behringer UMC404HD)
        │
        ▼ (USB)
  Streaming Laptop (Linux/Mac)
        │
        ▼
  FFmpeg Encoder (encode-all.sh)
  ┌─────┬─────┬─────┬─────┐
  │ CH1 │ CH2 │ CH3 │ CH4 │   Opus 128kbps + MP3 fallback
  └─────┴─────┴─────┴─────┘
        │
        ▼ (HTTPS / Icecast protocol)
  Cloud Streaming Server
  (DigitalOcean / Fly.io)
        │
        ├── Icecast:8000   → /channel1-4.ogg  (Opus)
        └── NGINX:8080     → /hls/channel1-4/ (HLS/AAC)
        │
        ▼ (CDN optional)
  Vercel (Next.js frontend)
        │
        ▼
  Audience phones (thousands of listeners)
```

---

## Step-by-Step Setup

### Phase 1 — Infrastructure (1–2 days before event)

#### 1. Deploy Streaming Server

**Option A: Docker Compose on a VPS**
```bash
# On your server (DigitalOcean, Hetzner, Vultr etc.)
git clone <this-repo>
cd silent-disco-platform

cp .env.example .env
# Edit .env with your passwords and domain

docker compose up -d icecast nginx api
```

**Option B: Fly.io**
```bash
# Install flyctl, then:
fly launch --name silent-disco-streaming
fly secrets set \
  ICECAST_SOURCE_PASSWORD=your-secret \
  ICECAST_ADMIN_PASSWORD=your-admin-secret
fly deploy
```

**Option C: Terraform (DigitalOcean)**
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Fill in API token, SSH key, passwords

terraform init
terraform plan
terraform apply

# Note the output IPs
```

#### 2. Deploy Web Frontend (Vercel)

```bash
cd apps/web
npx vercel

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_EVENT_ID=festival-2025
# NEXT_PUBLIC_EVENT_NAME="Summer Silent Disco 2025"
# NEXT_PUBLIC_EVENT_VENUE="O2 Arena, London"
# NEXT_PUBLIC_STREAMING_BASE_URL=http://YOUR_SERVER_IP:8000
# ICECAST_STATS_URL=http://YOUR_SERVER_IP:8000
# API_INTERNAL_URL=http://YOUR_API_IP:3001
```

#### 3. Test with Sine Waves

```bash
# Start test tones on all 4 channels
docker compose up ffmpeg

# Open http://localhost:3000 (or your Vercel URL)
# You should hear sine tones when selecting channels
```

---

### Phase 2 — Venue Setup (Day of Event)

#### Hardware Requirements

| Item | Recommended | Notes |
|------|-------------|-------|
| Audio interface | Focusrite Scarlett 4i4 / 18i8 | Needs 4+ inputs |
| Streaming laptop | Any modern laptop with USB | Stable internet required |
| Internet uplink | 50 Mbps+ dedicated | Shared WiFi unreliable |
| Backup connection | 4G/5G hotspot | In case venue WiFi drops |
| UPS | APC Back-UPS 600VA | Protects against power cuts |

#### Network Setup

```
[Venue router] ──► [Streaming laptop] ──► Cloud server
                         ▲
              [4G hotspot as fallback]
                  (auto-failover)
```

Configure a static IP or use `ip route` failover:
```bash
# Automatic failover script (run as daemon)
while true; do
  if ! ping -c 1 -W 2 8.8.8.8 &>/dev/null; then
    echo "Primary down — switching to 4G"
    ip route replace default via 192.168.2.1  # 4G router IP
  fi
  sleep 5
done
```

#### Audio Routing

**4-Input Audio Interface (e.g., Scarlett 4i4):**
```
FOH Board AUX 1 (Main Mix)   ──► Interface Input 1 ──► FFmpeg CH1
FOH Board AUX 2 (DJ Booth)   ──► Interface Input 2 ──► FFmpeg CH2
FOH Board AUX 3 (Stage Feed) ──► Interface Input 3 ──► FFmpeg CH3
FOH Board AUX 4 (Crowd Mix)  ──► Interface Input 4 ──► FFmpeg CH4
```

**Set input levels:**
- Aim for peaks at -12 dBFS (leave headroom)
- Use the interface's gain knobs to avoid clipping

#### Start Encoding

```bash
# Identify your ALSA device names
aplay -l

# Edit .env with correct device IDs
FFMPEG_INPUT_TYPE=alsa
ALSA_CH1=hw:2,0   # Your Scarlett device number
ALSA_CH2=hw:2,1
ALSA_CH3=hw:2,2
ALSA_CH4=hw:2,3

# Start encoders
docker compose up ffmpeg -d

# Monitor logs
docker compose logs -f ffmpeg
```

**Verify streams are live:**
```bash
# Check Icecast status
curl http://YOUR_SERVER:8000/status-json.xsl | python3 -m json.tool

# Test playback
ffplay http://YOUR_SERVER:8000/channel1.ogg
```

---

### Phase 3 — During the Event

#### Monitoring Dashboard

```bash
# Watch all encoder logs in real-time
docker compose logs -f ffmpeg

# Check listener counts every 30s
watch -n 30 'curl -s http://YOUR_SERVER:8000/status-json.xsl | python3 -c "
import sys, json
d = json.load(sys.stdin)
for s in d[\"icestats\"][\"source\"]:
    print(f\"{s[\"listenurl\"].split(\"/\")[-1]:20} {s[\"listeners\"]:5} listeners\")
"'
```

#### QR Code Distribution

Generate a QR code for the event URL and display on screens / print on wristbands:
```bash
# Install qrencode
apt install qrencode

qrencode -o event-qr.png -s 10 "https://your-event.vercel.app"
```

#### Common Issues & Fixes

| Problem | Symptom | Fix |
|---------|---------|-----|
| No audio | Channels show offline | Check FFmpeg logs, verify ALSA device |
| Clipping | Distorted audio | Reduce gain on audio interface |
| High latency | >5s delay | Reduce `hls_fragment` to 0.5s in nginx.conf |
| Drop-outs | Frequent buffering | Check uplink bandwidth usage |
| iOS no audio | Safari silent | Ensure HLS endpoint is working |
| Memory leak | Server memory growing | Restart Icecast (no listener disruption) |

#### Restart a Failed Channel

```bash
# Restart just one channel's encoder
docker compose exec ffmpeg supervisorctl restart channel2
```

#### Emergency Fallback: Direct FFmpeg on Laptop

If the Docker stack fails, run FFmpeg directly on the streaming laptop:
```bash
# Replace with your Icecast URL and password
ffmpeg -f alsa -i hw:2,0 \
  -c:a libopus -b:a 128k -vbr on -application audio \
  -f ogg "icecast://source:PASSWORD@YOUR_SERVER:8000/channel1.ogg"
```

---

### Phase 4 — After the Event

```bash
# Stop all services
docker compose down

# Download Icecast access logs for analytics
docker compose cp icecast:/var/log/icecast2/access.log ./logs/

# Destroy cloud infrastructure (if using Terraform)
cd infra/terraform
terraform destroy
```

---

## Audience Experience

1. **Audience arrives** — signage / wristbands show the event URL
2. **Open browser** — `https://your-event.vercel.app`
3. **Put in earphones** — prompted by the UI
4. **Select channel** — tap any of the 4 cards
5. **Audio starts within 2-3 seconds**
6. **Switch channels** — instant, smooth crossfade
7. **Volume control** — slider + mute button

> No app download required. Works on any modern phone browser.
