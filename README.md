# Scraps — reference study build

A local-first browser swordfighting game. The first milestone is a reliable standard duel engine. Roguelite progression and online systems follow after reference calibration.

## Play

Run `npm run dev`, then open http://127.0.0.1:4173. No dependency installation is required. Use a modern browser with Canvas, Web Workers, and Web Audio support. The hosted private build uses the same static files.

- Left / Right: move.
- Up: counterclockwise rotation. Down: clockwise rotation.
- Hold Space: fast fall; movement and rotation remain possible before lock.
- Each action can have up to four keys (Settings → Controls → +).
- Escape: pause. All six bindings can be changed in Settings.
- Duel view toggles the opponent's full board.

The lobby offers three AI opponents, your blade's drop pattern, and a browser-local sparring record. The Workshop offers freebuild, three example setups, break resolution, test strikes, pattern painting, mirroring, and pattern import/export. The last twenty played rounds are stored locally and can be replayed or exported.

## October gameplay revision

The September 26 recording exposed missing pacing in the first build. Version 2 adds travelling breaks, visible cascades, sequential incoming travel, tall pieces and vertical previews. Controls and original art remain. Version-1 and version-2 replays keep their original simulation. The handling update fixes fast-fall jumps and premature high-stack locking, adds tuck time, and makes breakers clearer and slightly more frequent. See `docs/mechanics.md` for timestamped observations and remaining uncertainties.

## Validation

`npm test` runs deterministic rule and replay tests. `node tests/simulate.mjs` runs four complete AI-versus-AI matches and replays every input to confirm identical final states. It also measures planning time. These tests are evidence for the implementation, not proof of full Puzzle Pirates parity.

## Structure

- `dist/engine.js`: deterministic rules and fixed-step match simulation.
- `dist/ai.js`, `dist/ai-worker.js`: legal-placement search with one visible next pair; computation happens outside the rendering thread.
- `dist/render.js`: original Canvas graphics and animations.
- `dist/app.js`: lobby, controls, settings, workshop, local history and sound.
- `dist/replay.js`: replay validation and trusted reconstruction.
- `tests/`: reproducible rule examples and match simulations.
- `docs/mechanics.md`: source evidence and unresolved fidelity questions.
- `docs/roadmap.md`: accepted scope and subsequent milestones.

## Honest status

This is a playable first build, not a flawless or certified exact replica. The user-confirmed gem conversions are authoritative. Timing, penetration beyond sampled strikes, piece distribution, wall kicks, detailed resolution ordering, and attack scheduling require further calibration. The AI plans its moves; it is not yet a reproduction of tournament-level human strategy.

Sinner’s Saber and Forgotten Falchion use the verified historical pattern diagrams. Ember, Tide and Moss are original practice patterns. Current Saber/Falchion data still needs a distinct verified reference; do not fabricate a different array to satisfy the names.

All gameplay graphics and audio are original. Reference screenshots and downloaded video excerpts are kept only in ignored `.reference/`; they are not shipped or published. Records and replays are browser-local, with no online accounts or simulated human lobby population.
