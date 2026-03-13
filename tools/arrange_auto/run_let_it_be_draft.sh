#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AUDIO_IN="$ROOT/tmp/audio-in/let-it-be.wav"
AUDIO_STEREO="$ROOT/tmp/audio-in/let-it-be.stereo.wav"
AUDIO_HARMONY="$ROOT/tmp/audio-in/let-it-be.harmony.wav"
LYRICS_IN="$ROOT/let_it_be_lyrics"
OUT_DIR="$ROOT/tmp/analysis-out/let-it-be-draft"
WEBM_IN="$ROOT/tmp/audio-in/let-it-be.webm"

if [[ ! -f "$AUDIO_IN" ]]; then
  echo "STEP|prepare_audio|Prepare audio input"
  if [[ -f "$WEBM_IN" ]]; then
    ffmpeg -y -i "$WEBM_IN" -ar 44100 -ac 1 "$AUDIO_IN" >/dev/null 2>&1
  else
    echo "ERROR|prepare_audio|Missing audio source"
    echo "Missing audio file: $AUDIO_IN (and no $WEBM_IN found)" >&2
    exit 1
  fi
  echo "DONE|prepare_audio"
else
  echo "STEP|prepare_audio|Prepare audio input"
  echo "DONE|prepare_audio"
fi

if [[ ! -f "$LYRICS_IN" ]]; then
  echo "ERROR|prepare_audio|Missing lyrics file"
  echo "Missing lyrics file: $LYRICS_IN" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# Build a harmony-focused stem by attenuating centered vocals.
# This is a fast local approximation when full source separation is unavailable.
echo "STEP|build_harmony|Build harmony-focused stem"
if [[ -f "$WEBM_IN" ]]; then
  ffmpeg -y -i "$WEBM_IN" -ar 44100 -ac 2 "$AUDIO_STEREO" >/dev/null 2>&1
else
  ffmpeg -y -i "$AUDIO_IN" -ar 44100 -ac 2 "$AUDIO_STEREO" >/dev/null 2>&1
fi
ffmpeg -y -i "$AUDIO_STEREO" \
  -filter_complex "pan=mono|c0=0.5*c0-0.5*c1,highpass=f=70,lowpass=f=6000,dynaudnorm=f=150:g=9" \
  -ar 44100 "$AUDIO_HARMONY" >/dev/null 2>&1
echo "DONE|build_harmony"

python3 "$ROOT/tools/arrange_auto/make_draft.py" \
  --audio "$AUDIO_IN" \
  --audio-alt "$AUDIO_HARMONY" \
  --lyrics "$LYRICS_IN" \
  --out-dir "$OUT_DIR" \
  --chart-start 0.0 \
  --max-bars 96

echo "Draft complete:"
echo "  $OUT_DIR/draft-summary.md"
echo "  $OUT_DIR/draft-arrangement.json"
echo "  $OUT_DIR/draft-bars.csv"
