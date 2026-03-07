# Piano Trainer - Session Memory

Last updated: 2026-03-07
Repo: `git@github.com:chadmeeks/piano-trainer.git`
Primary branch: `main`

## Current product state

- Top-level screens:
  - Circle (default)
  - Lessons
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

## Files that matter most

- Frontend state/logic: `public/app.js`
- Layout/controls: `public/index.html`
- Styling and readability: `public/styles.css`
- Continuity docs: `PROJECT_NOTES.md`, `docs/`

## Last pushed commit

- `8cb0f9b` - Refine lessons UX, timer/history, and technique toggles

## Suggested next steps

1. Song module redesign and parity with technique lesson quality.
2. History filtering by key/module and richer analytics.
3. Streak threshold tuning (e.g., minimum minutes/day).
4. MIDI-based scoring and objective mastery signals.
