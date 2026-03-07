# File Structure

Top-level structure:

- `server.js` - local static file server.
- `public/` - frontend app implementation.
- `README.md` - project overview and quick start.
- `PROJECT_NOTES.md` - continuity and roadmap notes.
- `docs/` - technical documentation.

## `public/`

- `public/index.html` - screen layout and control markup.
- `public/app.js` - app state, lesson generation, toggles, rendering logic.
- `public/styles.css` - visual design and component styling.

## Where to change what

- Navigation/screen flow: `public/app.js` + `public/index.html`
- Lesson content and transform logic: `public/app.js`
- Keyboard/staff visuals: `public/app.js` + `public/styles.css`
- Styling/theme/readability: `public/styles.css`
- Local runtime behavior: `server.js`
