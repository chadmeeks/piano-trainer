# Product Decisions Log

## Platform + Scope

- Platform: web app.
- Runtime target: local practice, TV-friendly sessions.
- Progression model: key-by-key with Circle of Fifths entry.

## Navigation Decisions

- App opens on Circle of Fifths, not a dashboard.
- Any key is selectable (no strict unlock gating).
- Key completion shown visually on circle nodes.

## Practice UX Decisions

- 88-key full-width keyboard is primary visual focus.
- Technique lessons include staff + keyboard.
- Songs are currently present but intentionally treated as a weaker first pass.

## Lesson Interaction Decisions

- Scales:
  - range toggle (`1 octave`, `2 octaves`)
  - direction toggle (`ascending`, `up/down`)
- Arpeggios:
  - mode toggles for LH/RH octaves and both-hands mode
- Triads/Inversions:
  - explicit step toggles instead of overloading `Prev/Next`

## Hand Guidance Decisions

- Both-hand lessons use LH/RH color distinction.
- Root-note emphasis is shown in triads/inversions.
- Root-finger metadata shown as guidance text for both hands.

## Tradeoffs Accepted

- Local-state simplicity over account sync.
- Fast iterative rendering logic over music-notation library integration.
- Manual practice guidance over objective MIDI scoring (for now).
