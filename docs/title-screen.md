# Tavern title screen and gilded theme

Added 7 Oct 2026. Presentation only: no changes to app.js, the engine or any rules.

## Files
- `dist/title/title.js`: title layer over the game. The menu clicks the existing `.nav-button[data-view]` buttons and `#settings-open`. Clicking the wordmark returns to the title when no match is in progress (it checks for `#exit-game`, `.challenge-arena`, `.rogue-playfield` or `.game-overlay.shown`).
- `dist/title/audio.js`: Web Audio synthesis (hearth crackle, night wind and crickets, lute-style music, menu sounds). It follows `scraps.preferences` (`sound`, `volume`). Music and fire/night toggles are stored in `scraps.title-audio`. Audio fades out when a mode opens.
- `dist/title/theme.css`: gilded tavern restyle of the shared UI. Piece colours `--red/--yellow/--green/--blue` are untouched.
- `dist/title/title.css`, `room.png`, `vista.png`, `portrait.png`, `fg.png`: title layer styles and pixel art (960x540 grid).
- `dist/index.html`: two stylesheets and one module script added.

## Automation
- The title is skipped when `navigator.webdriver` is true, so existing Playwright/Chrome QA is unaffected. `?title` forces it on; `?skip-title` hides it.
- `window.scrapsTitle.show()` and `.close()` are available for manual QA.
- `?title` must be passed to see the title in automated runs.

## Screen art (added later the same day)
- `dist/title/scenes/*.png`: a 960x540 pixel room per screen (spar, solo, chal, work, repl). `title.js` sets `body[data-scene]` from the active `.nav-button`.
- `dist/title/ui/*.png`: pixel 9-slices (panel, buttons, field, board frame, divider, checkbox, top beam) and 16x16 mode icons, shown at 2x via `border-image` in `theme.css`.
- Generic buttons get the wooden frame except list/grid controls (`.editor-cell`, `.swatch`, `.pattern-preset`, `.opponent`, `.sword-choice`, palette and pattern-editor buttons). New UI picks this up automatically. Use those classes (or `.text-button`) to opt out.

## Pieces, effects and sound (hooks into existing code)
- `dist/title/skin.js` (loaded before app.js) sets `globalThis.scrapsSkin`. `render.js` has small guarded hooks: `tile`, `sword`, gem slabs, the board tray and the clear wave call the skin when `scrapsSkin.ready`. Otherwise the original drawing runs, which covers Node tests. Positions and timings are unchanged; the skin only draws.
- Breakers are free-standing glowing blades, using each colour's existing silhouette. Blocks are bevelled gem tiles with the same silhouette carved in. Brightness order stays yellow > green > red > blue. Effects (breaker pulse, gem light sweep, clear shatter) are off under reduced effects.
- `dist/title/sfx.js` sets `globalThis.scrapsSfx`. `app.js` `sound()` gained one guarded line that hands off to it. All kinds go through it: move, lock, clear(chain), hit, start, win and end. The old beeps remain as the fallback.
