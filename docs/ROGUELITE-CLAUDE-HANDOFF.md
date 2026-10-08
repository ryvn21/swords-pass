# Scraps solo run: presentation and content handoff

Project: `D:\CodexProjects\Scraps`

This is an engineering foundation, with a deliberately simple adapter and provisional example content. The owner wants Claude to lead visuals, animation direction, theme, descriptions and eventual encounter/reward design. Existing art work under `art/` is separate from this update.

## Start here

Run `npm run dev` in the project, open `http://127.0.0.1:4173`, and choose **Solo run**. `npm test` runs all regression tests. `node tests/rogue-simulate.mjs` completes seeded runs without a browser and verifies restores in each puzzle phase. Optional seeds: `node tests/rogue-simulate.mjs 7 42 771`.

Current browser default: **Endless climb**. Its first engineering milestone is described below. The older three-duel campaign and `SURVIVAL_CAMPAIGN` still exist for authored finite runs and compatible saves. Upgrades and score persist across boards. Ordinary defeat or missed deadlines end the run; checkpoint bonus failure does not. There is no permanent upgrade currency, world map, boss subsystem, account sync or online leaderboard yet. These should be deliberate extensions, not inferred from screen artwork.

## Endless climb: current integration contract

The owner approved a procedural climb, PC only. Preserve the shared 6×13 board, remappable controls, handling profiles and the approved 125 ms default spawn adjustment time. Visual changes belong in the adapter, styles and renderer. The following modules own gameplay:

| File | Responsibility |
| --- | --- |
| `dist/climb-content.js` | Captured authored templates, difficulty bands, checkpoint schedule and existing ranked rewards; `validateClimb` validates and copies definitions |
| `dist/climb-objectives.js` | Bounded objective trees, progress and readable labels |
| `dist/climb-generator.js` | Deterministic route offers, bounded scaling, bonus encounters |
| `dist/climb-combat.js` | Shared engine/bot adapter, completed-clear scoring and queue pressure |
| `dist/climb-run.js` | Run transitions, carry checkpoints and current-encounter input history |
| `dist/climb-save.js` | Validated bounded replay and corruption checks |
| `dist/climb-view.js` | Detached presentation contract (`version:2`, `kind:'climb'`) |
| `tests/climb.test.mjs`, `tests/climb-simulate.mjs` | State/save regressions and real-engine autoplay |

Create new climbs with `createClimb`, exported by `rogue-run.js`. The existing `startEncounter`, `inputRun`, `stepRun`, `chooseReward` and `abandonRun` wrappers dispatch by run kind. Also exported are `choosePath`, `skipBonus` and `continueClimb`. `runView`, `serializeRun` and `restoreRun` similarly dispatch; old finite runs retain their behavior.

```js
import {
  createClimb, choosePath, startEncounter, inputRun, stepRun,
  chooseReward, skipBonus, continueClimb
} from './rogue-run.js';
import {runView} from './rogue-view.js';
import {serializeRun, restoreRun} from './rogue-save.js';

let run = createClimb({seed: 42, rules: savedHandling, pool: swordPool});
// Opening: ready. Later: choosePath(run, runView(run).paths[0].id) from route.
startEncounter(run);
inputRun(run, ['left', 'cw']);
stepRun(run); // one 1000/60 ms simulation tick
const view = runView(run);
run = restoreRun(serializeRun(run)); // UI resumes playing saves paused
```

Climb transitions:

```text
route --choosePath--> ready --startEncounter--> playing --success--> reward
                       |                         |                    |
                       |                         +--normal failure--> lost
                       |                         +--bonus failure---> result
                       +--skipBonus (bonus only)--------------------> result
reward --chooseReward--> next checkpoint or route/ready
result --continueClimb--> next route/ready
unfinished --abandonRun--> abandoned
```

The opening is an easy duel. Afterwards, routes offer a duel and a wave objective when both are eligible. The six reusable templates cover ordinary duels, optional duel bonuses, clear sprints, combo-or-clear challenges, short survival and rare higher-reward duels. No generator decision depends on inventory power, animation or reading time. Skill completes clear/combo/defeat objectives immediately; survival explicitly waits its authored duration. Default pressure increases through six bands, then holds the final band's bounds while generation continues. Difficulty does **not** increase without limit.

Default checkpoint bonuses occur after 5 and 10 combat wins, then every ten wins. They are separate, optional 35-second clear challenges. Winning grants another reward; failure/skipping forfeits that completion reward and continues. Each checkpoint can occur only once. Bonus rounds do not increment combat depth. Ordinary death wins over same-tick objective success.

For the climb snapshot:

- `depth` counts completed ordinary encounters; use `encounter.depth` when labeling the selected or just-finished encounter. `roomCount` is null. `nextCheckpoint` is the next scheduled checkpoint after completed depth.
- `paths` contains full offered encounters (ID, name, kind, objective, optional objective, duration, band, opponent or attacks). Route cards must invoke `choosePath` with an offered ID. Present objective and threat before committing.
- `objectiveText` and `objectiveProgress` describe the required objective. Leaves include `kind`, `value`, `target` and `complete`; groups include `kind`, `complete` and child `items`. Show the `all`/`any` distinction. `optionalProgress` is separate and never blocks a duel victory.
- `activeMs` includes only simulated play across encounters. `remainingMs` is the current encounter deadline. Menus, rewards, pause and hidden tabs do not advance either clock.
- `lastResult` includes success, reason, bonus status, score, completion points and optional completion. `results` retains the latest twelve results, not full run history.
- `inventory` and `offers` use the existing cumulative rank/effect previews with effective breaker limits. A fallback offer with `pointReward:true` banks 50 points if all available upgrades have capped out. It advances normally. Expanded reward lifetimes are a later milestone.
- `nextWave`, boards, inputs and semantic puzzle events retain the common contracts below. Default wave queues cap at two pending batches; a full queue holds the announced wave, then schedules from actual delivery, without an overdue burst. Show waiting status instead of a negative timer.
- Events are transient. Checkpoint preparation clears the previous batch; `eventId` remains monotonic. A reward animation should follow the command/UI transition, not assume a persistent `reward-chosen` log survives preparation. UI must never grant rewards from an animation callback.

Author objectives as leaves `{kind:'defeat'|'blocks'|'score'|'combo'|'survive', target}` or groups `{kind:'all'|'any', items:[...]}`. Survival targets are milliseconds. Trees allow at most seven nodes, nesting depth two and two or three children per group. Duel completion must be attainable when the opponent dies; extra performance requirements belong in `optional`. Waves cannot require defeat. Validation limits durations, objective targets, band speed/pressure, content size and effect definitions. `bank-points` is a reserved upgrade ID. Use the default content as an authoring example; UI cannot introduce executable effects.

Climb saves use envelope **version 2**, `kind:'climb'`, `climbVersion:1`, engine 9. A captured recipe plus compact completed carry and a journal reconstruct only the current encounter. Each transition checkpoints progress and bounds history; maximum replay is 10,800 ticks / 60,000 commands, with a 2 MB save limit. Completed carry contains totals, inventory, depth, consumed checkpoint and recent history, never a trusted mutable board. A checksum catches accidental corruption; this is local continuity, not verified leaderboard evidence. Existing envelope-version-1 finite saves still restore through their original policies.

Changing shared AI, upgrade evaluation, generation or engine behavior requires an explicit climb-policy compatibility decision and replay tests. Freeze/version the old policy before reinterpreting published journals. Captured content protects against content edits but cannot protect against changed execution code. The current browser has one local save and manual export; cloud sync, a backup slot and multi-tab ownership are separate future work.

Use `node tests/climb-simulate.mjs` for repeatable autoplay (default seeds 42, 771 and 7). See `roguelite-climb-foundation.md` for measured validation and `roguelite-development-roadmap.md` for future milestones. Autoplay is diagnostic; it does not establish human balance.

The remaining sections describe the common adapter and **legacy finite-run** APIs. Use the climb contract above when `view.kind === 'climb'`.

## File ownership and stable boundaries

| File | Responsibility | Typical owner |
| --- | --- | --- |
| `dist/rogue-content.js` | Campaign schema, sample definitions, effect types, seeded choices | Content: Claude/owner; schema and effect implementation: engineering |
| `dist/rogue-run.js` | Fixed-step simulation, state machine, attack queues, scoring, command journal | Engineering |
| `dist/rogue-bot.js` | Deterministic tick-based bot controller | Engineering |
| `dist/rogue-upgrades.js` | Ranked values and outgoing attack transformations | Engineering |
| `dist/legacy-rogue-run-v1.js`, `dist/legacy-rogue-content-v1.js` | Frozen old-save behavior; do not restyle or refactor | Engineering |
| `dist/rogue-save.js` | Validated save reconstruction and limits | Engineering |
| `dist/rogue-view.js` | Detached presentation snapshot | Shared interface; coordinate changes |
| `dist/rogue-ui.js` | Replaceable browser adapter and input/lifecycle handling | Claude, preserving behavioral contracts |
| `dist/rogue.css` | Scoped layout and presentation | Claude |
| `dist/render.js` | Shared board graphics for all modes | Claude, with cross-mode visual QA |
| `dist/engine.js` | Shared swordfighting mechanics | Engineering; do not change for cosmetic work |
| `tests/rogue.test.mjs` | Run/content/save regressions | Engineering |
| `tests/rogue-simulate.mjs` | Repeatable complete-run harness | Engineering |

No framework or new dependency is required. Files are native JavaScript ES modules. Source is shipped from `dist/`; that folder is not disposable generated output.

## Minimal controller example

```js
import {createRun, startEncounter, inputRun, stepRun, chooseReward, TICK_MS} from './rogue-run.js';
import {runView} from './rogue-view.js';
import {serializeRun, restoreRun} from './rogue-save.js';

let run = createRun({seed: 42, content: campaign, rules: savedHandling, pool: swordPool});
startEncounter(run);                // only from ready
inputRun(run, ['left', 'cw']);       // immediate; journalled at current tick
stepRun(run);                       // exactly TICK_MS = 1000 / 60 ms
const view = runView(run);          // detached snapshot; safe for presentation
const saveText = serializeRun(run); // JSON text
run = restoreRun(saveText);         // reconstruct, do not JSON.parse into engine state
// When view.phase === 'reward': chooseReward(run, view.offers[0].id)
```

Only the controller should own `run`. UI components read `runView(run)` and invoke controller commands. Never mutate `run.game`, inventory, tick counters or command logs to drive animations, give rewards or skip a room. Debug tests may construct board fixtures; shipped presentation must not.

### State transitions

```text
ready --startEncounter--> playing --objective--> reward --chooseReward--> ready
                            |                       (no eligible rewards skips to ready)
                            +--final objective--> won
                            +--board/deadline----> lost
any unfinished state --abandonRun--> abandoned
```

`stepRun` advances only `playing`. Invalid starts/rewards throw without altering state. Inputs outside playing return false. A reward is awarded once; reloading cannot reroll it. Fatal board contact takes priority over success in the same tick. Completed clear events score; a break animation starting does not score yet. Each new encounter resets the board, piece sequence and incoming queue, but keeps run totals and inventory.

### Presentation snapshot (version 1)

`runView` provides `phase`, `seed`, `title`, `roomIndex`, `roomCount`, `encounter`, `progress`, `remainingMs`, `totalScore`, `totalBlocks`, `bestCombo`, `roomScore`, `reason`, `inventory`, `offers`, `effects`, `nextWave`, `queuedWaves`, `board`, `rules`, `nextPair`, `results`, `events`, and capability booleans (`canStart`, `canChoose`, `canPlay`, `finished`).

- `roomIndex` is zero-based. `progress` uses milliseconds for survival, blocks for block objectives, points for score objectives, and 0/1 for defeat objectives. A duel is won by defeating the bot before the deadline; score alone cannot win. Simultaneous deaths lose the run.
- `board` is a cloned existing-engine player. Pass to `drawBoard`; `nextPair` goes to `drawNext`. Preserve the 6×13 geometry.
- `nextWave` includes attack dimensions/types, source pattern name, wave index and `inMs`. It predicts the same wave the engine queues; UI must not generate its own attack randomness.
- `inventory` entries include current `stacks`/`rank`; `offers` includes only eligible choices, `nextRank`, and effect entries `{kind, current, next}` with cumulative capped values. Repeated picks increase the same upgrade. All current upgrades last for the run.
- `opponent` is null for waves, otherwise includes name, difficulty, style, pace, board, nextPair, patternName and queuedWaves. Render its board and preview with the shared renderer. `sentSprinkles` and `sentSwords` count the actual upgraded outgoing attacks. `nextWave` is null in duels; do not read it without checking encounter kind.
- `rules` reflects the active board's handling. `effects` describes the current inventory; newly selected effects apply at the next encounter start.
- Pause belongs to the UI clock, not this snapshot. Do not call `stepRun` while paused or choosing rewards.

### Animation and sound events

Read `run.events` immediately after each command or step, or its cloned equivalent in `runView`. Each event has a monotonically increasing `id` and simulation `tick`. Events are a transient batch; consume once or track last seen ID. Do not replay old sound events when restoring a save.

Run events: `attack-sent` (actual sword/sprinkle counts), `encounter-started`, `attack-queued`, `scored`, `encounter-completed`, `rewards-offered`, `reward-chosen`, `route-advanced`, `run-won`, `run-lost`, `run-abandoned`.

Puzzle events: `puzzle-breaking`, `puzzle-clear`, `puzzle-lock`, `puzzle-hit`. `detail.side` identifies player 0 or bot 1; use player 0 for human clear/lock sounds. `detail` contains the existing engine payload, including cell positions/chain where applicable. `scored` includes points, cleared block count and chain. Animations must not award points themselves or postpone simulation by awaiting completion. Use board clear/attack/motion fields for continuous animation between events. The existing renderer already handles these phases.

## Authoring content

`validateCampaign(value)` returns a detached canonical copy and rejects invalid definitions. Unknown object fields are dropped; unknown effect/objective types are rejected. IDs are stable lowercase strings (letters, digits, hyphens; start with a letter). Display names can change independently.

Campaign fields: `version:1`, `id`, `name`, `description`, `route`, `encounters`, `upgrades`. The additive duel schema is:

```js
{
  id: 'opening-duel', name: 'Opening duel', description: 'Your briefing.',
  kind: 'duel', durationMs: 180000, objective: {kind: 'defeat', target: 1},
  opponent: {name: 'Pip', difficulty: 'easy', style: 0, pace: 0.85}
}
```

Difficulty is easy/medium/hard; style is 0–2; pace is 0.5–2 (higher means faster). No random wave schedule is used for a duel. The bot shares handling settings, but player-only breaker upgrades do not affect its pieces. The controller uses bounded one-ply planning at deterministic tick intervals. Changing AI policy or imported evaluation behavior requires a run-version compatibility decision and replay tests. Existing wave definitions remain supported:


```js
{
  id: 'example', name: 'Example encounter', description: 'Your briefing.',
  durationMs: 60000,
  objective: {kind: 'blocks', target: 24}, // or survive (ms), score (points)
  attacks: {
    firstMs: 8000, intervalMs: 12000, jitter: 0.1,
    swords: 1, width: 1, length: 4, sprinkles: 2
  }
}
```

`route: [['opening-a','opening-b'], ['middle'], ['final']]` chooses one encounter per slot using the seed. This is seeded content variation, not a player-selectable branching map. At most 8 slots and 24 authored encounters; worst-case route duration at most 10 minutes. Encounters last 1–180 seconds. Width-1 swords cannot exceed length 6. Attacks are queued as one batch per wave, due after the next placement.

```js
{
  id: 'clear-value', name: 'Your upgrade name', description: 'Your effect description.',
  maxStacks: 3,
  effects: [{kind: 'scorePercent', amount: 20}]
}
```

Implemented effect kinds (additive per stack):

| Kind | Meaning | Combined cap |
| --- | --- | --- |
| `scorePercent` | Percentage added to clear points | +200% |
| `chainBonus` | Extra points per combo stage above single, before percentage bonus | +300 per extra stage |
| `breakerBonus` | Absolute chance addition; `.02` means +2 percentage points | +.15, with final breaker chance ≤.4 |
| `attackDelayMs` | Extra delay before first and subsequent waves, after interval jitter; wave encounters only | 5,000 ms |
| `sprinkleBonus` | Extra sprinkles once per non-empty outgoing attack batch | +12 |
| `strikeHeightBonus` | Extra height on each vertical sword; horizontal swords unchanged | +6; resulting narrow height ≤6, wider height ≤13 (never shorten an existing longer sword) |

Attack modifiers run once before the attack batch enters the opponent queue. Empty/no-break turns do not manufacture attacks. Standard duels have no modifier hook; enemy attacks remain unchanged. Keep sword IDs, combo stages, directions and pattern metadata intact. Do not implement bonuses in renderers or sound handlers.

Base clear points are `(10 × blocks + 5 × max(0, blocks − 4)) × chain`. Add chain bonus, then apply percentage bonus, then round once. Effects are snapshotted at encounter start. Content supports 0–32 upgrades, each with 1–4 effects and 1–5 maximum stacks. If no eligible rewards remain, the next briefing appears automatically.

An upgrade such as “erase a row”, “shield a sword”, “change gem geometry” or “heal” needs a new tested effect implementation. Changing its icon/description cannot implement that behavior. Keep descriptions accurate when changing amounts.

## Saves, input and browser lifecycle

The browser adapter stores one current run under `scraps.rogue-run`, using the app's JSON storage wrapper. Exported files contain raw save JSON; localStorage contains that JSON string encoded by the wrapper. Saves record seed, captured content, handling and pattern pool, current tick, and an ordered command journal. They contain no authoritative mutable board snapshot. `restoreRun` rebuilds it using the current pinned engine and validates transitions.

Save envelope is version 1; new runs are run version 2, pinned to puzzle engine 9. Run-v1 saves reconstruct through the frozen legacy modules, with golden fixture hashes and continued-simulation tests. Version 2 reconstructs both live boards and bot decisions from the journal. Unknown versions are rejected with an actionable message. Do not reinterpret old journals with changed mechanics. Future engine updates must preserve the old implementation or explicitly migrate supported recipes/logs and test identical outcomes. These saves are for local continuity and debugging, not tamper-proof competitive scores.

Limits: 2 MB encoded JSON, 60,000 commands, 40,000 simulation ticks, 16 input actions per batch. Bounds are checked before replay. Export is available if storage fails. Invalid imports preserve the existing save. Confirm before replacing the one saved run.

Autosave occurs every simulated second and at transitions, pauses and exit. A crash can lose up to the last second. On restore, active encounters open paused. Navigation calls `beforeLeave()` and must honor false: failed persistence keeps the current run and export controls alive. `destroy()` stops the animation loop and aborts event handlers. OS/browser termination with unavailable storage cannot be guaranteed recoverable; export works without storage.

Input contract: use saved remappable keys; tap rotation once per keydown, ignore OS repeats, repeat held horizontal movement using captured repeat timings, hold Space for steerable fast fall. Clear held keys and send `fastOff` on pause, focus loss or exit. Pause on hidden tab, blur and opening settings. Gameplay settings changes apply to the next run; a saved run keeps its original timing. Cosmetic motion/sound preferences can update immediately.

## Integration acceptance checks

1. A complete run can start, receive actual attack batches, clear blocks, select rewards and finish or lose.
2. Reload during falling, clearing, settling, attack travel and rewards preserves outcomes and reward choices.
3. Pause, settings, navigation and touch cancellation cannot leave fast fall held or advance the clock.
4. A storage failure never discards the in-memory run through ordinary navigation; export remains reachable.
5. Text content is escaped. Malformed imports cannot execute code or create unbounded replay work.
6. Board remains 6×13; fast fall, narrow-shaft flips, spawn grace and standard duels are unchanged.
7. Run full tests, syntax/asset checks and desktop browser QA after replacing the presentation adapter. The owner explicitly requested PC-only gameplay checks.

## Intentionally open for you and the owner

- World/theme and terminology: ____________________
- Encounter identity and visual language: ____________________
- Reward iconography and selection animation: ____________________
- Run progress presentation: ____________________
- Board surrounds, feedback and sound direction: ____________________
- Desired future mechanics requiring engineering support: ____________________

Avoid inventing permanent power progression or changing controls as part of the visual pass. Discuss those as gameplay extensions.
