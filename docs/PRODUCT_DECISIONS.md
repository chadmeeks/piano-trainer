# Product Decisions Log

## Platform + Scope

- Web-first local prototype.
- Key-by-key progression anchored on Circle of Fifths.

## Navigation Decisions

- Default entry: Circle of Fifths.
- Dedicated `Admin` screen added for song arrangement/prep tooling.
- Dedicated `History` screen added (not embedded in Lessons).
- `Prev/Next` in practice reserved for chapter navigation.

## Lesson Interaction Decisions

- Scales:
  - one lesson per key (not separate RH/LH lessons)
  - toggles: hand, octave range, direction
- Arpeggios:
  - LH/RH + octave mode toggles and both-hands mode
- Triads/Inversions:
  - step chips for internal progression
  - `Prev/Next` does not cycle internal steps
- Songs:
  - song info and song chart are separate cards
  - explicit play vs arrange mode split
  - playback mode emphasizes chart + keyboard visibility
  - lesson-launched song practice is playalong-focused; arrange controls are admin-gated

## Visual Guidance Decisions

- Full-width 88-key keyboard as primary practice visual.
- Technique staff shown above keyboard.
- Both-hand lessons use LH/RH color coding.
- Root-note emphasis + root-finger guidance added for triads/inversions.
- Song bars support multiple chord events and display them as horizontal chips.
- Song mini staff uses beat-aligned event rendering (time-signature aware).
- Active chord/event highlight appears only while playback is actively running.

## Practice Tracking Decisions

- Lessons timer is the source of practice tracking.
- During active timer sessions:
  - day-level practice seconds are accumulated
  - viewed lessons are logged for that day
- History surfaces:
  - current streak
  - longest streak
  - practiced-day count
  - month calendar + day details
- Song-specific calibration decisions:
  - chart timing is calibrated from playback (`Set Chart Start`, `Tap Next Bar`)
  - calibration is persisted per song/source variant
  - section key/time signatures are editable and persisted per song
  - per-bar chord re-analysis can be requested from the chart (`Get Chords`)
  - per-bar analysis can infer slash inversions from estimated bass note

## Admin + Auto-draft Decisions

- Keep arrangement-generation local-first:
  - `Run Auto Draft` executes local analysis tools and publishes draft data
  - progress is visible in staged steps:
    - prepare audio
    - build harmony stem
    - analyze beat grid
    - build chord events
    - align sections and lyrics
    - publish/finalize
- Setup gating before arrangement access:
  - valid lyrics file
  - selected YouTube source
  - auto-draft completed
- Auto-draft source is treated as immutable baseline:
  - user edits are saved as named arrangement versions
  - playback can pin to a selected final version

## Arrangement Editing Decisions

- Arrange-mode chart exposes per-event lyric editing (not bar-only lyric editing).
- Timing tools include:
  - sequential tap anchors
  - anchor-based fill
  - rebuild from anchors (retime + all-bar chord rebuild + lyric remap)
- Version controls available in arrange mode:
  - save current
  - save as new
  - duplicate
  - load
  - set final
  - delete (with safeguards)

## Tradeoffs Accepted

- Local-only state over cloud sync.
- Lightweight custom notation rendering over external notation libraries.
- Manual practice workflow over objective score/evaluation (for now).
- Song arrangement currently maintained in code data structures, not a dedicated editor UI yet.
