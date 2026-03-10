# Project Notes: Piano Trainer

## Vision

Build a web app that helps practice piano key-by-key:
- learn scales, arpeggios, chords, inversions
- practice songs in the same key
- track practice consistency over time

## Current Product Shape

- Top-level navigation:
  - Circle
  - Lessons
  - History
- Circle of Fifths is the default landing screen.
- Any key can be selected (no lesson-gating model).
- Key completion is manually set and shown on the circle.

## Current UX Emphasis

- TV-friendly readability for practice sessions.
- 88-key full-width keyboard as primary visual anchor.
- Technique lessons include compact staff above keyboard.
- Step toggles for triads/inversions avoid overloading chapter navigation.
- Song lessons now prioritize playalong ergonomics:
  - sectioned chart + lyrics + mini staff
  - keyboard visible during playback
  - playback mode that reduces non-essential UI

## Implemented Highlights

- Scales are now one lesson per key with toggles:
  - hand (`Right Hand` / `Left Hand`)
  - range (`1 octave` / `2 octaves`)
  - direction (`ascending` / `up and down`)
- Arpeggios include mode toggles:
  - LH/RH and octave variants, plus both-hands mode.
- Triads and inversions have dedicated step chips.
- Triads/inversions/arpeggios support both-hand color mapping.
- Root-note and root-finger guidance shown for triads/inversions.
- Song trainer upgrades:
  - Song info split from song chart.
  - Arrange vs Play mode separation.
  - YouTube sync with play/pause and chart-follow behavior.
  - Per-song chart timing calibration (`Set Chart Start`, `Tap Next Bar`, reset).
  - Per-section key/time-signature override editor.
  - Let It Be expanded to full arrangement sections.
  - Bar model now supports multiple chord events in one 4/4 bar.
  - Chord-event chips shown horizontally per bar.
  - Mini staff draws chord events in beat positions across the bar.
  - Active chord highlighting is only shown while playback is actively running.

## Practice Tracking

- Lessons screen timer controls:
  - Start
  - Pause/Resume
  - Reset
- While timer session is active:
  - seconds are recorded to the current day
  - lessons viewed are logged by day
- History screen shows:
  - month calendar with practiced-day highlights
  - day-level lesson list and time
  - streak metrics

## Architecture Notes

- Single static Node server (`server.js`), no API layer.
- App state stored in `localStorage` key `pianoTrainerV2`.
- Core behavior in `public/app.js`.

## Suggested Next Work

1. Add dedicated song-arrangement editor screen (bar/chord-event timing, section mapping).
2. Improve Let It Be bar-level timing map to lock tightly to the selected recording.
3. Add practice-history filtering (key/module filters).
4. Add minimum-practice threshold for streak qualification.
5. Add MIDI input for objective feedback and scoring.
6. Add progress export/import for backup/recovery.
