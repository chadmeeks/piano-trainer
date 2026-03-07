# Product Decisions Log

## Platform + Scope

- Web-first local prototype.
- Key-by-key progression anchored on Circle of Fifths.

## Navigation Decisions

- Default entry: Circle of Fifths.
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

## Visual Guidance Decisions

- Full-width 88-key keyboard as primary practice visual.
- Technique staff shown above keyboard.
- Both-hand lessons use LH/RH color coding.
- Root-note emphasis + root-finger guidance added for triads/inversions.

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

## Tradeoffs Accepted

- Local-only state over cloud sync.
- Lightweight custom notation rendering over external notation libraries.
- Manual practice workflow over objective score/evaluation (for now).
