#!/bin/bash
# ─────────────────────────────────────────────────────────────
# encode-channel.sh — Encode a single audio channel to Icecast
#
# Usage:
#   ./encode-channel.sh <channel_number> [input_device]
#
# Environment:
#   ICECAST_HOST          Icecast server hostname (default: localhost)
#   ICECAST_PORT          Icecast port (default: 8000)
#   ICECAST_SOURCE_PASS   Source password
#   AUDIO_BITRATE         Opus bitrate in kbps (default: 128)
#   INPUT_TYPE            alsa | pulse | jack | rtmp | test (default: test)
#
# Examples:
#   ./encode-channel.sh 1 hw:0,0       # ALSA device
#   ./encode-channel.sh 2 pulse        # PulseAudio
#   ./encode-channel.sh 1              # Test tone (dev mode)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

CHANNEL="${1:-1}"
INPUT_DEV="${2:-}"

ICECAST_HOST="${ICECAST_HOST:-localhost}"
ICECAST_PORT="${ICECAST_PORT:-8000}"
ICECAST_SOURCE_PASS="${ICECAST_SOURCE_PASS:-hackme}"
AUDIO_BITRATE="${AUDIO_BITRATE:-128}"
INPUT_TYPE="${INPUT_TYPE:-test}"

ICECAST_URL="icecast://source:${ICECAST_SOURCE_PASS}@${ICECAST_HOST}:${ICECAST_PORT}"
MOUNT_OGG="/channel${CHANNEL}.ogg"
MOUNT_MP3="/channel${CHANNEL}.mp3"

echo "[channel${CHANNEL}] Starting encoder → ${ICECAST_HOST}:${ICECAST_PORT}${MOUNT_OGG}"

# ─── Build FFmpeg input arguments ────────────────────────────

case "${INPUT_TYPE}" in
  alsa)
    DEV="${INPUT_DEV:-hw:0}"
    INPUT_ARGS="-f alsa -thread_queue_size 4096 -i ${DEV}"
    ;;
  pulse)
    DEV="${INPUT_DEV:-default}"
    INPUT_ARGS="-f pulse -thread_queue_size 4096 -i ${DEV}"
    ;;
  jack)
    DEV="${INPUT_DEV:-ffmpeg}"
    INPUT_ARGS="-f jack -thread_queue_size 4096 -i ${DEV}"
    ;;
  rtmp)
    # Pull from local RTMP ingest server
    INPUT_ARGS="-i rtmp://localhost:1935/live/channel${CHANNEL}"
    ;;
  test)
    # Sine-wave test tone — useful for development
    INPUT_ARGS="-f lavfi -i sine=frequency=$((200 + CHANNEL * 100)):sample_rate=48000"
    ;;
  *)
    echo "Unknown INPUT_TYPE: ${INPUT_TYPE}" >&2
    exit 1
    ;;
esac

# ─── FFmpeg encoding pipeline ────────────────────────────────
#
# Stream 0: Ogg/Opus → Icecast  (primary, lowest latency)
# Stream 1: MP3      → Icecast  (fallback for old players)
#
# Opus settings:
#   -application audio       — optimise for general audio (not voice)
#   -vbr on                  — variable bitrate for quality
#   -compression_level 10    — best compression
#   -frame_duration 20       — 20 ms frames (standard)
#
# ─────────────────────────────────────────────────────────────

exec ffmpeg \
    -hide_banner \
    -loglevel warning \
    -stats \
    \
    ${INPUT_ARGS} \
    \
    -filter_complex "[0:a]asplit=2[ogg][mp3]" \
    \
    -map "[ogg]" \
    -c:a libopus \
    -b:a "${AUDIO_BITRATE}k" \
    -vbr on \
    -compression_level 10 \
    -application audio \
    -frame_duration 20 \
    -ar 48000 \
    -ac 2 \
    -f ogg \
    -content_type audio/ogg \
    -ice_name "Silent Disco – Channel ${CHANNEL}" \
    "${ICECAST_URL}${MOUNT_OGG}" \
    \
    -map "[mp3]" \
    -c:a libmp3lame \
    -b:a "${AUDIO_BITRATE}k" \
    -q:a 2 \
    -ar 44100 \
    -ac 2 \
    -f mp3 \
    -content_type audio/mpeg \
    "${ICECAST_URL}${MOUNT_MP3}"
