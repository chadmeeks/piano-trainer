# Song Data Sources

## Goal
Keep canonical song arrangement/lyrics/chords in a source-backed library, and keep user timing edits separate.

## Canonical Library
- File: `public/song-library.js`
- Global: `window.PIANO_TRAINER_SONG_LIBRARY`
- Keyed by key center (example: `C`)
- Each song includes:
  - Core metadata (`title`, `artist`, `songKey`, `timeSignature`, `youtubeId`)
  - `arrangementSource` object (provenance)
  - `sectionSpecs` (section order + bar content)

## Runtime Build
- `public/app.js` builds runtime chart objects from `sectionSpecs` via:
  - `librarySongSpecForKey(...)`
  - `buildSongDataFromSpec(...)`

This produces `measures` and `formSections` used by rendering/playback.

## Override Policy
- `songArrangementOverrides`: user structural edits in Arrange mode (merge/split/reset)
- `songTimingOverrides`: user playback timing anchors / bar starts
- `songSectionOverrides`: section-level key/time edits

These are user-state overlays and should not replace canonical library source files.

## Let It Be Source
- Canonical data currently comes from `public/song-library.js`
- Source label shown in Song Info as `Arrangement Source`.
- Current source is explicitly marked as curated/manual until replaced by a licensed or approved reference transcription.
