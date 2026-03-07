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

1. Song lesson UX redesign (currently weaker than technique modules).
2. Add practice-history filtering (key/module filters).
3. Add minimum-practice threshold for streak qualification.
4. Add MIDI input for objective feedback and scoring.
5. Add progress export/import for backup/recovery.
