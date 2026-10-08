# Endless climb foundation

Implementation scope approved by the owner on 7 October 2026. Implements milestone 1 of `roguelite-development-roadmap.md`; preserves standard duels and v1/v2 run saves. PC only. Existing handling, 6×13 geometry and the 125 ms default spawn pause remain unchanged. Visual art stays with Claude/the owner.

## Design decisions

- A new climb controller composes the shared combat engine. The existing finite-run controller stays intact for old saves and authored finite campaigns.
- Seeded offers depend on depth and recent template history, never rendering, inventory power or time spent reading. The opening is an easy duel. Later encounters offer a regular path and an alternative, with bounded difficulty bands and no forced ending.
- Supported objective leaves: defeat, blocks, score, combo, survive. `all`/`any` groups are bounded and validated. Duel objectives must allow victory when the opponent dies; performance requirements belong in optional bonuses. Completed clears drive scoring/objectives.
- Five initial regular templates: duel, duel with a performance bonus, clear sprint, combo-or-clear challenge and brief survival. Rare variants use an explicit higher objective/reward. Checkpoint bonus template appears after depths 5 and 10, then every ten depths. Failure or skipping a checkpoint bonus forfeits its reward and continues; ordinary defeat/deadline ends the run.
- A combat victory advances depth once, then offers the existing ranked rewards. A checkpoint bonus does not advance combat depth. Exhausted rank pools award a labelled score bonus and remain navigable; expanded reward lifetimes are milestone 2.
- Checkpoint carry includes validated totals, inventory, recent encounter history, depth, checkpoint status and active time. The current encounter is reconstructed from a bounded command journal and a captured recipe. This is local continuity, not verified competitive proof. Never accept mutable board snapshots. Checkpoint checksums detect accidental corruption, not deliberate tampering.
- State and UI expose depth, next checkpoint, selected objective, optional bonus, threat, active time and recent results. Pause/settings/tab hiding stop both boards and clear held input. Existing finite runs still render and resume.

## Tasks

1. **Objectives and generation** — `climb-objectives.js`, `climb-content.js`, `climb-generator.js`. Write tests for completion/validation, seed reproducibility, bounded pressure, no repetitive streaks, checkpoint cadence, and thousands of generated encounters including deep depths.
2. **Controller and rewards** — `climb-run.js`, `climb-combat.js`. Write tests for early objective completion, defeat priority, route validation, successful/failed/skipped bonus rounds exactly once, no forced depth cap, caps/exhausted rewards, and shared control isolation. Keep finite-run dispatch compatible.
3. **Bounded saves** — `climb-save.js`, existing `rogue-save.js`. Test mid-fight/reward/route reconstruction, checkpoint continuity, corruption and impossible journals, old run-v1/v2 fixtures, bounded save work after many encounters. No cloud service in this milestone.
4. **Playable adapter** — `climb-view.js`, existing `rogue-view.js`/`rogue-ui.js`. Add basic route cards, objective progress, checkpoint briefing and recent-result display. Test on desktop through real controls, pause, refresh, failed storage and imports; update Claude's presentation contract.
5. **Review and release** — complete tests, syntax/assets, seeded simulations, independent read-only code review, then publish only the gameplay files through the existing private Site workflow. Preserve unrelated title-screen work.

## Validation ledger

- All 166 regression tests pass, including 13 new climb tests. Coverage includes composed objectives, seeded generation, queue backpressure, checkpoint success/failure/skip, effective reward caps, malformed imports, old-save compatibility and unchanged handling.
- Real engine autoplay: seeds 42 and 771 reached depth 10. Seed 42 also reached depth 22 with checkpoints 5, 10 and 20 completed. Save/restore was identical in falling, entry, clearing, attack, settling and reward phases. Largest sampled save in that deeper run: 6,868 bytes. Seed 7 timed out in the opening duel; this is a balance signal, not proof that human play is unfair or that the sample is balanced.
- Desktop Chrome checks cover real movement/rotation/fast-fall input, paused restore of both boards, failed-storage export/navigation, invalid imports preserving the old save, selectable routes, checkpoint reward/skip flow, stable reward offers across reload, legacy run-v1/v2 imports and ordinary practice. No mobile gameplay checks.
- Syntax and module/static-asset checks pass. Independent code review completed; malformed checkpoint validation, effective breaker caps and reward-screen depth labeling were corrected.
- Gameplay calibration and build balance remain provisional. This milestone does not add multi-opponent run encounters, temporary effects, equipment rewards, badges, cloud recovery, a tutorial or a verified leaderboard.
