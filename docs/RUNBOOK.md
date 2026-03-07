# Runbook

## 1) Start app

From repo root:

```bash
npm start
```

Open:

- `http://localhost:3000`

## 2) Core operations

- Select key from Circle of Fifths.
- Open lesson and practice module.
- Use module-specific toggles (scale/arpeggio/triad/inversion controls).
- Mark modules done and optionally mark key complete.

## 3) Troubleshooting

### A) Page loads but controls seem stale

- Hard refresh browser (`Cmd+Shift+R`).

### B) Progress appears corrupted or unexpected

- Clear `localStorage` for site and reload.
- This resets persisted progress/preferences.

### C) UI/lesson state feels inconsistent after big changes

- Reload page to reset transient runtime state.
- If needed, clear `localStorage`.

## 4) Operational guidance

- This prototype is local-first and single-user.
- `localStorage` is the only persistence layer.
- Use git commits regularly since there is no server-side data recovery.
