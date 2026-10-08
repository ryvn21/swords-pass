# Solo roguelite foundation

Approved scope: a one-board encounter, reward choice, next encounter, and run completion or defeat. Build the engineering foundation; visual direction and finished content belong to Claude and the owner.

## Contract

- Keep the existing 6×13 engine, controls, timing preferences, duels and challenges unchanged. Compose a practice match; do not fork its puzzle rules.
- A run has explicit `ready`, `playing`, `reward`, `won`, `lost`, `abandoned` states. Only playing advances simulation. Each encounter starts a fresh board. Inventory and total score carry over; incoming queues do not.
- All simulation advances in fixed 60 Hz ticks. Separate seeded random streams select encounters, rewards and attack patterns. UI frame rate, wall-clock time and cosmetic randomness never decide gameplay.
- Content is JSON-compatible, validated and snapshotted at run creation. Ordered route slots may each contain several encounter IDs, with one chosen by seed. Supported objectives: survive, clear a number of blocks, reach a score. Every encounter has a time limit, bounded attack schedule and readable briefing.
- Test campaign: three short encounters, then completion. Choose one of up to three eligible rewards after each non-final encounter. Rewards have stable IDs, stack limits and explicit additive effects: score percentage, chain points, breaker probability, or extra time between attacks. No arbitrary scripts in content. Effects begin next encounter. No permanent power progression in this foundation.
- Hazard batches wait for the next placement and use the existing simultaneous-attack rules. Defeat wins over a simultaneous objective completion. Only completed clears score. Time limits never advance while paused or choosing rewards.
- Saves contain a versioned initial recipe plus an ordered input/decision journal, not executable objects or trusted board snapshots. Loading validates bounds and replays that journal using the pinned engine version. Incompatible/corrupt saves produce a useful error without overwriting the original. Current limits: 2 MB, 60,000 commands, 40,000 ticks, total configured encounter time ≤10 minutes.
- UI receives a detached view model, semantic events and a cloned board for the existing renderer. It issues explicit actions; it must not mutate simulation. Local save/export/import and an intentionally plain playable adapter prove the complete loop.

## Implementation plan

1. `dist/rogue-content.js`: strict content validation, sample definitions, deterministic route/reward selection and modifier calculation. Test invalid ranges/IDs, immutable snapshots, seeded choices and capped stacking.
2. `dist/rogue-run.js`: fixed-tick state machine over the existing engine. Test actual clears and received attacks, objective and defeat ordering, invalid transitions, fresh-board boundaries, effect application and deterministic runs.
3. `dist/rogue-save.js` and `dist/rogue-view.js`: bounded journal reconstruction and detached presentation model. Test mid-fall, mid-clear, queued-attack and reward saves, corrupt/future versions and repeated round trips.
4. `dist/rogue-ui.js` and scoped CSS: minimal playable Solo run navigation, briefings, board, reward choices, pause, save/resume and JSON import/export. Reuse bindings and sound; pause on blur, settings and tab hiding. Storage errors remain visible and export remains available.
5. Headless full-run harness, full regression suite, browser QA at desktop/mobile, and Claude integration documentation. Publish through the existing private Sites workflow.

## Review focus

Reject reward double-selection and commands during terminal states. Keep next attack generation independent of rendering and save frequency. Never re-roll rewards by reloading. Reject malicious or excessive saves before replay work. Release held inputs when pausing or leaving. Preserve existing modes and avoid publishing local reference/art folders.

## Verification ledger

Implementation and validation results are recorded below after execution.

- Implemented all five tasks in the existing checkout, keeping the puzzle engine unchanged.
- Added `docs/ROGUELITE-CLAUDE-HANDOFF.md` with schema, commands, events, save policy, authoring examples and presentation ownership.
- Ruling: sample content has three encounters and four modifier primitives. No permanent progression or visual theme is implied; this proves a complete loop while leaving authored detail to Claude/the owner.
- Review found and fixed inherited inventory properties and failed-storage navigation loss. Regression coverage includes `constructor` as an authored ID and quota failure followed by navigation/export.
- Headless seeded runs: seed 7 won, seed 42 lost, seed 771 won. Each reconstructed identical engine state from saves in fall, entry, clear, settle and attack phases; outcomes remained identical after terminal restore.
- Browser QA passed real controls, pause, save/resume, quota failure, invalid import preservation, stable reward reload, a complete short authored run, mobile layout and return to existing practice.
- Tests and syntax/asset checks are run again against the final source before publication.
