# Piano Trainer (Prototype)

Local web app for key-by-key piano practice with a Circle of Fifths landing screen, technique modules, and song modules.

Project continuity notes live in `PROJECT_NOTES.md`.
Session resume context lives in `SESSION_MEMORY.md`.
Technical docs live in `docs/`.

## What this prototype does

- Landing workflow:
  - Opens on Circle of Fifths.
  - Click a key to open lessons.
  - Mark key completion and reflect that visually on circle nodes.
- Lessons workflow:
  - Technique modules: scales, arpeggios, triads, inversions.
  - Song modules per key (C has named songs, other keys use placeholder drills).
  - Per-lesson toggles for scale/arpeggio/triad/inversion variations.
  - Song trainer split into:
    - Song info card (title, artist, key, time signature, progression, arrangement, credits)
    - Song chart card (sectioned bars, chord events, lyrics, mini staff)
    - Always-on keyboard in play mode
- Practice visuals:
  - Full-width 88-key keyboard with overlaid black keys.
  - Finger overlays and LH/RH color coding for both-hand lessons.
  - Technique staff above keyboard.
  - Song mini staff:
    - beat-aligned chord-event notation per bar
    - active-event highlight while video is playing
    - inactive state when playback is not running
- History workflow:
  - Dedicated `History` screen (not embedded in lessons).
  - Calendar showing practiced days and lessons viewed per day.
  - Current streak, longest streak, and total practiced-day stats.

## Quick start

1. Start app:

```bash
npm start
```

2. Open:

- `http://localhost:3000`

## Notes

- Runtime state is browser-local via `localStorage` (`pianoTrainerV2`).
- Server is a static file server (`server.js`) with no backend API routes.
- This is a local prototype focused on iteration speed.
- Song timing calibration and section key/time-signature overrides are persisted per song.

## Documentation

- `docs/ARCHITECTURE.md` - frontend/runtime architecture and data flow
- `docs/FILE_STRUCTURE.md` - file/folder map for maintainers
- `docs/PRODUCT_DECISIONS.md` - key product/UX decisions and tradeoffs
- `docs/STORAGE_SCHEMA.md` - persisted `localStorage` schema
- `docs/RUNBOOK.md` - run and troubleshooting guide
