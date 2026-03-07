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
  "scaleDirection": "up"
}
```

## Fields

- `selectedKey` string
  - Current key in lessons context.
- `keyProgress` object
  - Map by key name (for example `"C"`, `"G"`, ...):
    - `completed` boolean
    - `modules` object (`scales`, `arpeggios`, `chords`, `inversions`, `songs`) booleans
- `streak` number
  - Daily session streak.
- `lastSessionISO` string or `null`
  - Last completed session timestamp.
- `arpeggioMode` string
  - One of: `lh-1`, `lh-2`, `rh-1`, `rh-2`, `both`.
- `scaleMode` string
  - `1` or `2` (octave range).
- `scaleDirection` string
  - `up` or `updown`.

## Notes

- Not all runtime-only fields are persisted.
- Temporary UI state (current lesson step indexes) is in-memory only.
- Clearing browser storage resets progress and preferences.
