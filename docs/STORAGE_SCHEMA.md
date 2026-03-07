# Storage Schema (`localStorage`)

Key: `pianoTrainerV2`

Top-level shape:

```json
{
  "selectedKey": "C",
  "keyProgress": {},
  "streak": 0,
  "lastSessionISO": null,
  "arpeggioMode": "both",
  "scaleMode": "1",
  "scaleHand": "rh",
  "scaleDirection": "up",
  "practiceHistory": {},
  "selectedHistoryDateKey": null
}
```

## Fields

- `selectedKey` string
  - Current key context in lessons.

- `keyProgress` object
  - Keyed by pitch class (for example `"C"`, `"G"`):
    - `completed` boolean
    - `modules` object with booleans:
      - `scales`, `arpeggios`, `chords`, `inversions`, `songs`

- `streak` number
  - Cached current streak value (also derived from history data).

- `lastSessionISO` string or `null`
  - Most recent timer activity timestamp.

- `arpeggioMode` string
  - `lh-1`, `lh-2`, `rh-1`, `rh-2`, `both`.

- `scaleMode` string
  - `1` or `2` octaves.

- `scaleHand` string
  - `rh` or `lh`.

- `scaleDirection` string
  - `up` or `updown`.

- `practiceHistory` object
  - Keyed by day (`YYYY-MM-DD`):
    - `seconds` number
    - `lessons` object keyed by lesson id:
      - `title`, `key`, `moduleId`

- `selectedHistoryDateKey` string or `null`
  - Last selected day on History screen.

## Notes

- Transient runtime fields (current screen, indexes, etc.) are not fully persisted.
- Clearing site storage resets progress, preferences, and practice history.
