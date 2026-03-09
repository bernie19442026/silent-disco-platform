# FFmpeg Encoding Pipelines

All commands use **Opus** as the primary codec (128kbps, VBR) with MP3 as fallback.

## Production Commands (4 Channels)

### Channel 1 — Main Mix (ALSA)
```bash
ffmpeg \
  -f alsa -thread_queue_size 4096 -i hw:0,0 \
  -filter_complex "[0:a]asplit=2[ogg][mp3]" \
  \
  -map "[ogg]" \
  -c:a libopus -b:a 128k -vbr on -compression_level 10 \
  -application audio -frame_duration 20 \
  -ar 48000 -ac 2 \
  -f ogg -content_type audio/ogg \
  -ice_name "Channel 1 - Main Mix" \
  "icecast://source:PASSWORD@streaming.yourevent.com:8000/channel1.ogg" \
  \
  -map "[mp3]" \
  -c:a libmp3lame -b:a 128k -q:a 2 \
  -ar 44100 -ac 2 -f mp3 \
  "icecast://source:PASSWORD@streaming.yourevent.com:8000/channel1.mp3"
```

### Channel 2 — DJ Booth (ALSA)
```bash
ffmpeg \
  -f alsa -thread_queue_size 4096 -i hw:0,1 \
  -filter_complex "[0:a]asplit=2[ogg][mp3]" \
  \
  -map "[ogg]" \
  -c:a libopus -b:a 128k -vbr on -compression_level 10 \
  -application audio -frame_duration 20 \
  -ar 48000 -ac 2 -f ogg \
  "icecast://source:PASSWORD@streaming.yourevent.com:8000/channel2.ogg" \
  \
  -map "[mp3]" \
  -c:a libmp3lame -b:a 128k -q:a 2 \
  -ar 44100 -ac 2 -f mp3 \
  "icecast://source:PASSWORD@streaming.yourevent.com:8000/channel2.mp3"
```

### Channel 3 — Stage Feed (ALSA)
```bash
ffmpeg \
  -f alsa -thread_queue_size 4096 -i hw:1,0 \
  -filter_complex "[0:a]asplit=2[ogg][mp3]" \
  \
  -map "[ogg]" \
  -c:a libopus -b:a 128k -vbr on -compression_level 10 \
  -application audio -frame_duration 20 \
  -ar 48000 -ac 2 -f ogg \
  "icecast://source:PASSWORD@streaming.yourevent.com:8000/channel3.ogg" \
  \
  -map "[mp3]" \
  -c:a libmp3lame -b:a 128k -q:a 2 \
  -ar 44100 -ac 2 -f mp3 \
  "icecast://source:PASSWORD@streaming.yourevent.com:8000/channel3.mp3"
```

### Channel 4 — Crowd Mix (ALSA)
```bash
ffmpeg \
  -f alsa -thread_queue_size 4096 -i hw:1,1 \
  -filter_complex "[0:a]asplit=2[ogg][mp3]" \
  \
  -map "[ogg]" \
  -c:a libopus -b:a 128k -vbr on -compression_level 10 \
  -application audio -frame_duration 20 \
  -ar 48000 -ac 2 -f ogg \
  "icecast://source:PASSWORD@streaming.yourevent.com:8000/channel4.ogg" \
  \
  -map "[mp3]" \
  -c:a libmp3lame -b:a 128k -q:a 2 \
  -ar 44100 -ac 2 -f mp3 \
  "icecast://source:PASSWORD@streaming.yourevent.com:8000/channel4.mp3"
```

---

## Alternative Input Sources

### PulseAudio (Linux desktop / studio PC)
```bash
# List available sources first:
pactl list sources short

ffmpeg \
  -f pulse -thread_queue_size 4096 -i alsa_input.usb-Focusrite_Scarlett_2i2.analog-stereo \
  -c:a libopus -b:a 128k -vbr on -application audio \
  -f ogg "icecast://source:PASSWORD@host:8000/channel1.ogg"
```

### JACK (Professional audio routing)
```bash
# Register as JACK client named "ffmpeg_ch1", then connect in patchbay
ffmpeg \
  -f jack -thread_queue_size 4096 -i ffmpeg_ch1 \
  -c:a libopus -b:a 128k -vbr on -application audio \
  -f ogg "icecast://source:PASSWORD@host:8000/channel1.ogg"
```

### From RTMP ingest (pull mode)
```bash
ffmpeg \
  -i "rtmp://nginx:1935/live/channel1" \
  -c:a libopus -b:a 128k -vbr on -application audio \
  -f ogg "icecast://source:PASSWORD@icecast:8000/channel1.ogg"
```

### HLS output alongside Icecast
```bash
# Send to both Icecast AND generate HLS segments
ffmpeg \
  -f alsa -i hw:0,0 \
  -filter_complex "[0:a]asplit=3[ogg][hls][mp3]" \
  \
  -map "[ogg]" -c:a libopus -b:a 128k -f ogg \
    "icecast://source:PASSWORD@host:8000/channel1.ogg" \
  \
  -map "[hls]" -c:a aac -b:a 128k \
    -f hls -hls_time 1 -hls_list_size 6 \
    -hls_flags delete_segments+append_list \
    /tmp/hls/channel1/index.m3u8 \
  \
  -map "[mp3]" -c:a libmp3lame -b:a 128k -f mp3 \
    "icecast://source:PASSWORD@host:8000/channel1.mp3"
```

---

## Test Tone (Development / QA)

Sine wave test tones at different frequencies per channel:

```bash
# Channel 1 — 300 Hz
ffmpeg -f lavfi -i "sine=frequency=300:sample_rate=48000" \
  -c:a libopus -b:a 64k -f ogg \
  "icecast://source:hackme@localhost:8000/channel1.ogg"

# Channel 2 — 440 Hz (concert A)
ffmpeg -f lavfi -i "sine=frequency=440:sample_rate=48000" \
  -c:a libopus -b:a 64k -f ogg \
  "icecast://source:hackme@localhost:8000/channel2.ogg"

# Channel 3 — 528 Hz
ffmpeg -f lavfi -i "sine=frequency=528:sample_rate=48000" \
  -c:a libopus -b:a 64k -f ogg \
  "icecast://source:hackme@localhost:8000/channel3.ogg"

# Channel 4 — 852 Hz (binaural beat demo)
ffmpeg -f lavfi -i "sine=frequency=852:sample_rate=48000" \
  -c:a libopus -b:a 64k -f ogg \
  "icecast://source:hackme@localhost:8000/channel4.ogg"
```

---

## Codec Reference

| Codec | Format | Bitrate | Latency | Notes |
|-------|--------|---------|---------|-------|
| libopus | OGG | 64–128 kbps | ~20ms | **Recommended. Best quality/bitrate.** |
| libopus | OGG | 96 kbps | ~20ms | Good for mobile bandwidth |
| libmp3lame | MP3 | 128 kbps | ~26ms | Fallback for legacy devices |
| aac | HLS/fMP4 | 128 kbps | 1s+ | iOS Safari native support |
| libvorbis | OGG | 128 kbps | ~20ms | Older alternative to Opus |
| pcm_s16le | WAV | 1411 kbps | ~0ms | Studio monitoring only |

## FFmpeg Flags Explained

| Flag | Value | Meaning |
|------|-------|---------|
| `-vbr on` | — | Variable bitrate (better quality) |
| `-compression_level` | 10 | Maximum compression (CPU ↑, quality ↔) |
| `-application` | audio | Optimize for music (not voice) |
| `-frame_duration` | 20 | 20ms frames — standard for Opus |
| `-thread_queue_size` | 4096 | Buffer for real-time capture |
| `-b:a` | 128k | Target bitrate |
| `-ar` | 48000 | Opus native sample rate |
| `-ac` | 2 | Stereo |
