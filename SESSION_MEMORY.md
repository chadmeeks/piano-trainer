# Piano Trainer - Session Memory

Last updated: 2026-03-12
Repo: `git@github.com:chadmeeks/piano-trainer.git`
Primary branch: `main`

## Current product state

- Top-level screens:
  - Circle (default)
  - Lessons
  - Admin
  - History
- Circle of Fifths supports key selection and key-complete visual state.
- Lessons screen contains:
  - Session timer controls (`Start`, `Pause/Resume`, `Reset`)
  - Lesson library
  - Key staff reference
- Practice screen supports:
  - Full-width 88-key keyboard
  - Technique staff above keyboard
  - module-specific toggles:
    - scales: hand/range/direction
    - arpeggios: LH/RH octave modes + both
    - triads: step chips
    - inversions: step chips
  - song trainer:
    - Song info card and Song chart card are separated.
    - Song chart grouped by sections (Intro/Verse/Chorus/etc).
    - Play mode keeps keyboard visible and chart scrolls independently.
    - Playback mode supports play/pause, enter/exit, and optional video visibility.
    - Bar cards support multiple chord events in one bar.
    - Chord-event chips render horizontally per bar.
    - Mini staff renders beat-aligned chord events with time-signature guides.
    - Active chord highlighting is shown only while playback is actively playing.
    - Lesson entry is playalong-only; arrange tools are available via Admin workflow.
    - Source selector and timing are source-scoped by arrangement source.
    - Per-bar `Get Chords` can apply beat-level chord events from anchored timing windows.
    - Per-bar analysis can infer slash-chord inversions.

## Admin arrangement workflow

- Admin screen supports:
  - Song list + key filter (currently Let It Be)
  - YouTube candidate selection
  - `Run Auto-draft Now` with progress steps/logs
  - `Auto-arrange` to switch to current auto-draft source
  - Open arrangement page in arrange mode
- Backend API endpoints:
  - `POST /api/admin/auto-draft/run`
  - `GET /api/admin/auto-draft/status`
  - `POST /api/song/analyze-bar`

## Important interaction model

- `Prev/Next` in practice is chapter-level navigation.
- Internal lesson steps for triads/inversions are controlled by chips, not `Prev/Next`.
- Root-note + root-finger guidance appears on triads/inversions.

## Practice history model

- Stored in `localStorage` (`pianoTrainerV2`).
- Tracks per day:
  - total practiced seconds
  - unique lessons viewed while timer session is active
- History screen provides:
  - current streak
  - longest streak
  - practiced-day count
  - month calendar + day details

## Song trainer state model

- Per-song timing calibration persisted in `songTimingOverrides[exerciseId::sourceId].barStarts`.
- Per-song section metadata persisted in `songSectionOverrides[exerciseId].sections`.
- Per-song arrangement edits persisted in `songArrangementOverrides[exerciseId].measures`.
- Per-song source/video selection persisted in `songSourceChoice` / `songVideoChoice`.
- Song follow-along runtime tracks:
  - `activeMeasureIndex`
  - `activeChordEventIndex`
  - `videoPlaying`

## Let It Be specifics

- Song arrangement in code now follows:
  - `Intro -> A B A B Solo C B -> Outro`
- Chart supports bars with multiple chord events and beat-level event highlighting.

## Files that matter most

- Frontend state/logic: `public/app.js`
- Layout/controls: `public/index.html`
- Styling and readability: `public/styles.css`
- Continuity docs: `PROJECT_NOTES.md`, `docs/`

## Last pushed commit

- Pending push in current working session (admin split, autodraft API/progress, timing fixes, per-bar chord analysis).

## Suggested next steps

1. Build dedicated song-arrangement tooling (section/bar/chord-event editor).
2. Tighten Let It Be timing calibration against recording transitions.
3. History filtering by key/module and richer analytics.
4. Streak threshold tuning (e.g., minimum minutes/day).
5. MIDI-based scoring and objective mastery signals.
