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
  - Key lessons
  - Practice view
  - Dedicated history view
- Curriculum domain:
  - Scales, arpeggios, triads, inversions, songs
  - Module-specific transforms/toggles
- Practice telemetry domain:
  - Timer state
  - Per-day practice seconds
  - Per-day lessons viewed

## 3) State Model (high level)

Main in-memory + persisted state includes:

- Navigation/context:
  - `screen`, `selectedKey`
- Lesson control state:
  - `arpeggioMode`
  - `scaleHand`, `scaleMode`, `scaleDirection`
  - `chordStepIndex`, `inversionStepIndex`
- Timer/session:
  - `blockSecondsRemaining`
  - `timerRunning`, `timerSessionActive`
- Progress:
  - `keyProgress[<key>]` (`completed`, module booleans)
- History:
  - `practiceHistory[YYYY-MM-DD]` with `seconds` and `lessons`
  - `selectedHistoryDateKey`, `historyMonthOffset`

## 4) Data Flow

1. App boot:
- Load persisted state from `localStorage`.
- Render Circle, Lessons, History, Practice shells.

2. Key selection:
- Circle key click sets `selectedKey`.
- Curriculum is generated dynamically per key.

3. Lesson rendering:
- Base lesson selected by current block/index.
- Optional transforms applied:
  - scale hand/range/direction
  - arpeggio mode
  - triad step
  - inversion step

4. Practice tracking:
- Timer tick increments daily `seconds`.
- Viewed lessons are recorded by day while timer session is active.

5. History rendering:
- Calendar aggregates stored day entries.
- Day selection reveals lesson list + practice duration.

## 5) Rendering Subsystems

- Keyboard:
  - 88-note map (`A0`..`C8`)
  - white-key grid + black-key overlay
  - hand-aware highlight/finger rendering
- Staff:
  - compact grand staff with clef glyphs
  - note mapping from diatonic index
  - ledger line generation for out-of-staff notes
  - optional LH/RH color legend

## 6) Known Constraints

- No backend API or cloud sync.
- No auth/multi-user model.
- History/progress data is browser-local.
- Song content and song UX are less mature than technique modules.
