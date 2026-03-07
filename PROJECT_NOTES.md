# Project Notes: Piano Trainer

## Vision

Build a web app that helps practice piano key-by-key:
- learn scales, arpeggios, chords, inversions
- practice songs in the same key
- mark keys complete over time

## Current Direction

- Landing page: Circle of Fifths.
- User selects any key (no gating).
- Lessons for that key include both technique and songs.
- Completion is visualized back on the circle.

## Current UX Emphasis

- TV-friendly readability for practice sessions.
- Full-width 88-key keyboard as primary visual anchor.
- Technique lessons can show staff + keyboard together.
- Triads and inversions are step-based via explicit toggle chips.

## Implemented Highlights

- Circle of Fifths key selection screen.
- Key lesson screen with completion controls.
- Practice screen with:
  - Scales range/direction toggles
  - Arpeggio mode toggles (LH/RH/2-octave/Both)
  - Triad step toggles (I, IV, V, vi)
  - Inversion step toggles (root/1st/2nd across I/IV/V/vi)
- Both-hand coloring for triads/inversions/arpeggios.
- Root-note + root-finger guidance for triads/inversions.

## Architecture Notes

- Single static Node server (`server.js`), no API layer.
- Application state in browser `localStorage` under `pianoTrainerV2`.
- Core logic in `public/app.js`.

## Suggested Next Work

1. Song module redesign (currently less mature than technique modules).
2. Add MIDI input support for objective feedback.
3. Add objective mastery scoring per module/key.
4. Expand key-specific song content quality beyond placeholders.
5. Add export/import for local progress backups.
