# Piano Trainer Architecture

## 1) Runtime Model

- Stack:
  - Node.js static file server (`server.js`)
  - Browser app (`public/index.html`, `public/app.js`, `public/styles.css`)
- Persistence:
  - Browser `localStorage` only (`pianoTrainerV2`)
- Deployment model:
  - Local single-user prototype

## 2) Core Domains

- Navigation domain:
  - Circle of Fifths landing
  - Key-specific lessons
  - Practice and completion screens
- Curriculum domain:
  - Scales, arpeggios, triads, inversions, songs
  - Per-module lesson transformations (toggles/modes)
- Visual practice domain:
  - 88-key keyboard rendering
  - Staff rendering and note mapping
  - Hand-aware coloring (LH/RH)

## 3) Application State

Main state is maintained in-memory and partially persisted:

- Global/session:
  - `selectedKey`, `screen`, `streak`, `lastSessionISO`
- Lesson controls:
  - `arpeggioMode`, `scaleMode`, `scaleDirection`
  - `chordStepIndex`, `inversionStepIndex`
- Progress:
  - `keyProgress[<key>]` with module completion + key completion flag

## 4) Data Flow

1. App boot:
- Load persisted state from `localStorage`.
- Render circle + selected key lessons.

2. Key selection:
- Circle button sets `selectedKey`.
- Curriculum is generated for that key.

3. Lesson transforms:
- Base lesson selected from curriculum.
- Optional transforms applied (scale mode, chord step, inversion step, arpeggio mode).

4. Rendering:
- Keyboard and staff read transformed lesson notes/fingering.
- Root-note guidance and LH/RH coloring applied when available.

## 5) Keyboard/Staff Rendering

- Keyboard:
  - Programmatically generates 88 notes (`A0` to `C8`).
  - White keys as base grid; black keys overlaid by anchor offsets.
  - Active notes and fingers rendered per lesson state.
- Staff:
  - Compact grand staff with clef glyphs.
  - Noteheads mapped via simple diatonic index function.
  - Ledger lines generated for out-of-staff notes.

## 6) Known Constraints

- No backend API or multi-device sync.
- No authentication.
- Progress tied to browser/device storage.
- Song module quality is currently less developed than technique module depth.
