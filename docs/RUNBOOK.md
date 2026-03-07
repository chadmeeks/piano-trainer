# Runbook

## 1) Start app

From repo root:

```bash
npm start
```

Open:

- `http://localhost:3000`

## 2) Core workflow

1. Open key from Circle of Fifths.
2. Use Lessons screen to start timer.
3. Open lessons and practice in Practice screen.
4. Review logged days/lessons in History screen.

## 3) Timer + history behavior

- `Start`: enables active session tracking.
- `Pause/Resume`: toggles timer accumulation.
- `Reset`: stops timer and resets visible elapsed counter.
- While active, lesson views are logged to the current day.

## 4) Troubleshooting

### A) UI seems stale after changes

- Hard refresh browser (`Cmd+Shift+R`).

### B) Unexpected progress/history values

- Clear `localStorage` for `localhost:3000`.
- Reload app.

### C) Calendar seems empty

- Ensure timer was started before practice.
- Lesson views only log during active timer sessions.

## 5) Operational guidance

- Prototype is local-first and single-user.
- `localStorage` is source of truth for app progress/history.
- Commit frequently; there is no server-side recovery.
