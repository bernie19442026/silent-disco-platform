#!/bin/bash
# ─────────────────────────────────────────────────────────────
# encode-all.sh — Launch all four channel encoders in parallel
#
# Each channel runs encode-channel.sh in a supervised loop
# with exponential back-off on failure.
#
# Environment:
#   INPUT_TYPE    alsa | pulse | jack | rtmp | test
#   ALSA_CH1–4   ALSA device strings per channel (if INPUT_TYPE=alsa)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT_TYPE="${INPUT_TYPE:-test}"

# Map channel number → ALSA device (override per channel)
declare -A ALSA_DEVICES
ALSA_DEVICES[1]="${ALSA_CH1:-hw:0,0}"
ALSA_DEVICES[2]="${ALSA_CH2:-hw:0,1}"
ALSA_DEVICES[3]="${ALSA_CH3:-hw:1,0}"
ALSA_DEVICES[4]="${ALSA_CH4:-hw:1,1}"

# Supervised encoder loop with exponential backoff
run_encoder() {
  local CHANNEL="$1"
  local DEVICE="${2:-}"
  local BACKOFF=2

  echo "[supervisor] Channel ${CHANNEL} starting (device: ${DEVICE:-auto})"

  while true; do
    if INPUT_TYPE="${INPUT_TYPE}" "${DIR}/encode-channel.sh" "${CHANNEL}" "${DEVICE}"; then
      BACKOFF=2  # reset on clean exit
    else
      echo "[supervisor] Channel ${CHANNEL} exited with error. Retrying in ${BACKOFF}s…"
      sleep "${BACKOFF}"
      BACKOFF=$(( BACKOFF < 60 ? BACKOFF * 2 : 60 ))
    fi
  done
}

# Launch all four encoders in background
for CH in 1 2 3 4; do
  DEV=""
  if [[ "${INPUT_TYPE}" == "alsa" ]]; then
    DEV="${ALSA_DEVICES[$CH]}"
  fi
  run_encoder "${CH}" "${DEV}" &
done

echo "[supervisor] All four channel encoders started."
echo "[supervisor] Press Ctrl-C to stop all."

# Forward signals to all background children
trap 'kill $(jobs -p) 2>/dev/null; exit 0' SIGINT SIGTERM

wait
