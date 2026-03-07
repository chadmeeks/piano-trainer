# Piano Trainer (Prototype)

Local web app for key-by-key piano practice with a Circle of Fifths entry point, technique modules, and song modules.

Project continuity notes live in `PROJECT_NOTES.md`.
Technical docs live in `docs/`.

## What this prototype does

- Landing workflow:
  - Opens on Circle of Fifths.
  - Click a key to open that key's lessons.
  - Mark a key complete to reflect progress on the circle.
- Lessons workflow:
  - Technique modules: scales, arpeggios, triads, inversions.
  - Song modules per key (C has named songs; other keys use placeholder song drills).
  - Per-lesson toggles (scale range/direction, arpeggio hand modes, triad/inversion step toggles).
- Practice visuals:
  - Full-width 88-key keyboard with black-key overlay.
  - Finger overlays and LH/RH color coding for both-hand content.
  - Staff shown for technique lessons.

## Quick start

1. Start app:

```bash
npm start
```

2. Open:

- `http://localhost:3000`

## Notes

- Runtime state is browser-local via `localStorage` (no database yet).
- Server is a static file server (`server.js`) with no backend API routes.
- This is a local prototype focused on iteration speed.

## Documentation

- `docs/ARCHITECTURE.md` - frontend/runtime architecture and data flow
- `docs/FILE_STRUCTURE.md` - file/folder map for maintainers
- `docs/PRODUCT_DECISIONS.md` - key product/UX decisions and tradeoffs
- `docs/STORAGE_SCHEMA.md` - persisted `localStorage` schema
- `docs/RUNBOOK.md` - run and troubleshooting guide
