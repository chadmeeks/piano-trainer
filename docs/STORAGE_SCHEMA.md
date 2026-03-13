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
  "selectedHistoryDateKey": null,
  "songTimingOverrides": {},
  "songSectionOverrides": {},
  "songArrangementOverrides": {},
  "songSourceChoice": {},
  "songVideoChoice": {},
  "songArrangementVersions": {},
  "songVersionSelectionBySong": {},
  "adminSongPrep": {},
  "adminSongKeyFilter": "all",
  "adminSelectedSongId": "",
  "songCalibrationStride": 1
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

- `songTimingOverrides` object
  - Keyed by song exercise id and source-scoped id (`exerciseId::sourceId`).
  - Shape:
    - `barStarts`: array of numeric seconds (bar start timestamps)
    - `anchors`: map of `barIndex -> timeSec`
    - `stride`: tap stride used during calibration (`1|2|4|8`)

- `songSectionOverrides` object
  - Keyed by song exercise id.
  - Shape:
    - `sections`: object keyed by section name
      - `keySignature` string
      - `timeSignature` string

- `songArrangementOverrides` object
  - Keyed by song exercise id.
  - Shape:
    - `measures`: edited measure array (chord events, lyric/event text, timing)

- `songSourceChoice` object
  - Keyed by song id.
  - Selected base source id (for example `let-it-be-hybrid-v2`).

- `songVideoChoice` object
  - Keyed by song id.
  - Selected YouTube video id.

- `songArrangementVersions` object
  - Keyed by song id.
  - Shape:
    - `versions`: array of saved arrangement snapshots
    - `finalVersionId`: selected final version id for playback flow

- `songVersionSelectionBySong` object
  - Keyed by song id.
  - Currently selected version id in arrange workflow UI.

- `adminSongPrep` object
  - Keyed by song id.
  - Shape:
    - `lyricsText`
    - `lyricsFileName`
    - `lyricsValid`
    - `lyricsMessage`
    - `videoSelected`
    - `autoDraftReady`

- `adminSongKeyFilter` string
  - Admin song-list key filter value.

- `adminSelectedSongId` string
  - Last selected admin song.

- `songCalibrationStride` number
  - Last selected tap stride for timing capture.

## Notes

- Transient runtime fields (current screen, indexes, etc.) are not fully persisted.
- Song playback runtime state (active bar/event, player readiness, video playing flag) is transient and not persisted.
- Clearing site storage resets progress, preferences, and practice history.
