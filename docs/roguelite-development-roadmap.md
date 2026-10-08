# Scraps roguelite development roadmap

Draft for discussion, 7 October 2026. This records the owner's direction for an endless climb and proposes a small initial content set. It is a product and engineering roadmap, not approval to implement every milestone at once. Visual direction, asset creation, theme and final presentation remain with the owner and Claude.

## Agreed direction

- PC only, including gameplay testing.
- A progressively harder, partly procedural playthrough. Rounds can have different lengths, and skill should allow faster progress.
- An endless procedural climb that can expand in scale and difficulty while remaining fair. Mix quick, demanding and rare high-reward events, with bonus rounds at checkpoints such as 5, 10 and 20. Those numbers are initial examples; keep the schedule configurable.
- Mix bot strength, opponent count, clear/score/combo objectives and other authored challenges.
- Let players choose different builds. Avoid rewards that become useless, mandatory upgrade paths, or builds that prevent use of ordinary swordfighting skills.
- Include repeatable upgrades for the run, bonuses for the next encounter, and sword equipment choices. Values can increase through ranks of the same definition.
- Long-term progression centres on a badge gallery: requirements on hover and keyboard focus, progress toward each badge, overall completion, cosmetics, and some small permanent starting benefits.
- The interface exposes the player's growing build, current challenge and progression.
- Scores should feed a leaderboard. Saving and continuing should work reliably for site users.
- An optional tutorial should introduce the available systems in under two minutes. Start with a small, carefully tested content set, then expand.
- Preserve the current controls, the approved 125 ms default spawn adjustment time, and each saved handling profile. Roguelite bonuses must not silently change standard duel rules.

## Current foundation and gaps

**Milestone 1 implementation, 7 October 2026:** New browser runs now use the endless climb, with composed objectives, early completion, seeded route choices, bounded difficulty bands, checkpoint bonuses and per-encounter save journals. See `roguelite-climb-foundation.md` for the tested scope. The baseline and later milestones below record the original plan; the whole roadmap is not yet implemented.

The current source has three one-on-one bot encounters, deterministic 60 Hz simulation, run-scoped ranked modifiers, a detached presentation model, and recipe/input-journal saves. Run version 2 and legacy version 1 are supported. Wave-based survival, block and score objectives also remain available to authored campaigns.

Missing systems include composed objectives, multiple live opponents in a run encounter, choice-based route generation, temporary effects, sword rewards, badge progression, verified public rankings and a tutorial. Current authoring limits include a ten-minute maximum route and 40,000 simulation ticks; they are implementation bounds, not the intended final run design. Extend them through bounded segment saves and versioned replay support, rather than simply removing every limit.

## Recommended playthrough structure

Use authored encounter templates assembled by a seeded generator. A fully authored route gives tighter pacing but little variation; unrestricted procedural encounters would be harder to balance and could create impossible combinations. The template approach leaves room for player choice while keeping encounters understandable and testable.

The run has no designed final encounter. Begin with an easy duel, then generate upcoming encounters in bounded segments. Record combat depth separately from bonus events; a bonus round does not advance the counter and trigger itself again. Offer occasional choices between types of encounter, with objective and threat information visible before choosing.

Proposed first sample: six reusable encounter templates, with the opening ten combat encounters receiving the most balance attention. Continue beyond ten using the same tested templates and bounded difficulty bands, rather than ending the run. Checkpoints at 5 and 10 exercise the bonus-round flow; 20 and later checkpoints reuse its definitions. Test deeper bands as well and describe their balance as provisional until human playtesting supports them. A small catalogue can support endless generation without claiming endless content variety.

Use configurable checkpoint schedules and event weights, not depth-specific branches scattered through the engine. Persist each checkpoint as an exactly-once event. Rare high-reward encounters must explain their extra challenge and rewards before commitment. “Premium” is currently interpreted as rarity/reward quality; monetisation is not implied.

Most rounds finish as soon as their required objectives are satisfied. Survival objectives have an explicit minimum duration and should be used sparingly. Show a deadline only where the encounter actually has one; warn before timed pressure increases. Do not make a player who has already won sit through the remaining time.

Generate from depth-specific budgets for opponent strength, opponent count, objectives and incoming pressure. Two enemies consume more of the budget than one. Stronger AI, shorter deadlines and more attackers should not all increase together by default. Overall pressure rises, with room for a recovery encounter between demanding rounds.

Fairness constraints take priority over the escalation budget: bound queue growth, simultaneous threats, required reaction time, board geometry and achievable objectives. Do not accelerate the player's piece controls as a difficulty shortcut. Reaching a safe numeric cap should lead to harder combinations of supported challenges, not unbounded attack spam. A player's actual mistake can still be fatal; fair generation does not guarantee survival or quietly rescue every weak build. Adding new deep-run mechanics is a later authored expansion.

Difficulty follows depth and the risks the player chooses; do not secretly counterpick a successful build or raise pressure to cancel an upgrade's benefit. Limit repetitive event streaks, honour prerequisites and supply a deterministic, valid fallback when a generated combination is rejected. Checkpoint bonuses should offer a change of pace rather than another mandatory peak-pressure fight.

Use separate random streams for route choices, reward offers, opponents and pieces. Save every choice and its resulting offers. Reloading, UI animations and time spent reading must not reroll anything.

## Encounters and objectives

Objectives need explicit composition: `all` for required conditions, `any` where alternatives are allowed, and separate optional bonuses. The briefing and HUD must make those distinctions visible.

Begin with these reusable templates, with numeric tuning kept in content:

| Template | Completion | Variation |
| --- | --- | --- |
| Duel | Defeat one opponent | Bot style, strength and sword |
| Duel with a bonus | Defeat one opponent | Optional clear, score or combo milestone |
| Clear challenge | Reach a clear or score target | Authored attacks and a deadline |
| Survival challenge | Survive a short interval | Clearly signposted attack progression |
| Multiple opponents | Defeat the named opponents | Enemy count and shared pressure budget |
| Checkpoint bonus | A short bonus objective with explicit failure stakes | Extra reward choices or another authored benefit |

Never require further clears after the last enemy dies unless the encounter explicitly enters another playable phase. Required combat and performance conditions must be jointly achievable; optional bonuses can reward expertise without blocking a build. A combo requirement must not depend on owning a particular reward.

For multiple opponents, proposed baseline: the player selects one target; defeated targets switch automatically to a surviving enemy. Every enemy's attacks come from its own clears. A later target-count upgrade can send one completed batch to more enemies. Define queue ownership, target changes, simultaneous knockouts and the fate of already queued attacks before shipping this system. Preserve one move = one batch and the established simultaneous-sword rules for every recipient.

## Rewards and build variety

Use one definition per upgrade with explicit ranks and a preview of the actual change. Start with additive rank progression; add unusual scaling only when there is a gameplay reason.

| Reward type | Lifetime | Sample |
| --- | --- | --- |
| Run upgrade | Remaining run | +1, then +2, then +3 sprinkles per outgoing batch |
| Temporary bonus | One committed encounter | Double outgoing sprinkles for that encounter |
| Sword equipment | Until replaced during the run | Different attack pattern with any extra property listed separately |

Receiving or opening a briefing must not consume a temporary bonus. Starting the encounter binds it to that encounter; pause, save and restore keep it active without applying it twice. Its duration and expiry remain visible. Do not accidentally consume bonuses during the tutorial or practice.

A sword pattern changes attack distribution; it is not inherently a raw damage increase. Compare the old and new pattern before equipping. Offer an explicit keep-current choice when a replacement would not suit the player's build. Any added damage property must be implemented and displayed separately.

Proposed reward safeguards:

- Show distinct choices where the eligible pool permits, including at least one broadly useful option. Filter capped effects, incompatible durations and rewards with no opportunity to apply in the generated segment.
- Allow some build-relevant offers without repeatedly steering players into a predetermined class. Leave opportunities to change direction.
- Every build retains ordinary clears, gems, chains and targeting. Upgrade identities can emphasise those skills without disabling the others.
- Limit multiplicative stacking. Define modifier order once: base attack conversion, additive effects, multipliers, rounding and caps, then recipient routing. Preview the same effective values that combat uses.
- Score-focused upgrades require real opportunities to earn score, while attack-focused upgrades should gain value from quicker and more reliable victories. Neither should be the automatic choice for every goal.
- Evaluate reward selections and complete builds over many seeds and controlled player policies. Look for repeatedly dominant choices, impossible matchups and rewards that are never useful. Automated play is a diagnostic, not proof of human balance.

Proposed first content budget: six run-upgrade definitions, two temporary bonuses and two meaningfully different sword choices. Reuse their ranks instead of filling the catalogue with near-duplicates. Use two of the templates for quick/checkpoint variants and a constrained rare-event variant; do not create a separate subsystem for every event label. Exact effects and tuning remain open for owner-led design.

An endless climb also needs an explicit reward policy after rank caps are reached. Eligible temporary bonuses, equipment alternatives and checkpoint opportunities can keep choices useful without infinite permanent stat inflation. Never generate three maxed or ineffective cards, or stop progression because no rank upgrade remains.

## Badges and permanent progression

Begin with six badge definitions drawn from depth/checkpoint milestones, skilled clears/chains, build variety and optional challenge accomplishments. Give each a stable ID, requirement, progress counter, reward and earned state. Reveal progress on hover and keyboard focus; include an accessible detail view.

Define completion as earned badges divided by the available badges in a named collection. Adding a new collection should not silently erase an already completed collection's status. Hidden accomplishments can reveal their requirement after discovery without making the displayed denominator misleading.

Most initial rewards should be cosmetic or represent accomplishments. Small permanent starting benefits are allowed, but need a low shared cap and must not become prerequisites for early encounters. Mark them separately from current-run upgrades. Final permanent bonus values require balance testing.

Award each badge and reward once, through a recorded completion event. Save run progress and profile grants atomically so reloading a victory screen cannot duplicate a benefit.

## Score and leaderboards

Use a score breakdown that explains progress, completed clears, combos, optional objectives and bounded completion-efficiency bonuses. Do not reward waiting or endlessly farming an easy enemy. Keep any limited scoring window visible and stop scoring at encounter completion. No bonus formula is final until farming and build-balance tests exist.

Recommended initial public competition: a seeded challenge leaderboard, grouped by challenge, rules/content version and a common handling preset. Keep permanent power bonuses normalised in that competition; ordinary adventure runs retain earned progression. Display both score and depth reached. Offer distinct deepest-climb and score comparisons so score-oriented builds have a meaningful goal. Score comparisons should use a defined depth window or challenge, not reward someone merely for grinding a much longer run. Different seeds or difficulty rules should not be presented as directly equivalent. A checkpoint can record a verified best while the run continues; submitting twice must not add the same score twice.

Personal bests can work locally first, but a public ranking requires a backend that issues run IDs/seeds, validates command journals against the pinned rules and rejects duplicate or invalid submissions. A valid local replay alone does not prove that a score was not fabricated, automated or repeatedly retried. Define submission/attempt policy explicitly; mark local imports and custom-rule runs ineligible for verified rankings. Cosmetics do not affect eligibility.

## Saves and timing

Retain automatic saving at decisions and roughly once per simulated second during play. Add a recoverable previous checkpoint, clear resume information, an export path and protection against two tabs overwriting the same active run. A failed write must leave the playable in-memory run and previous valid save intact.

Persist the seed, generated offers, route choices, upgrade ranks, temporary-effect lifecycle, equipment, profile grants and rules/content versions. Restore exactly the same board, queues and objective progress, initially paused. Saves must survive refreshes, mid-animation exits and reward-screen reloads without rerolls or extra grants.

For longer playthroughs, store bounded segment checkpoints plus journals with version/hash checks. Local snapshots can accelerate recovery, but public score validation cannot trust a client snapshot. Keep old-run support or provide an explicit export/compatibility path before updates. Loading must not freeze the interface while replaying a long history.

Browser-local continuity is the first stage. Cross-device or cleared-browser recovery requires accounts and cloud sync; it is a separate service milestone, not a property of local storage. If cloud saves are added, show conflicts and let the user choose a version rather than silently overwriting progress.

All gameplay durations use simulation ticks. Pause, tab hiding, reward choices and tutorial reading stop the gameplay clock; backgrounded play does not suddenly catch up on resume. Cosmetic animations follow events and never delay input or decide outcomes. Record active play time separately from menu time for score reporting. Preserve the current piece timings while encounter pacing is tuned separately.

## Interface and tutorial

Grow the visible interface as systems become relevant: objective and opponent first, then run upgrades, temporary bonuses, equipment, depth and the next bonus checkpoint. Keep important controls in stable places and the board at a consistent readable size. A collapsed build summary can expand for current values, next rank, caps, source and expiry. Badge notifications should not cover live pieces. Claude owns the visual treatment of these contracts.

Proposed optional tutorial: about 90–120 seconds of guided content, skippable and replayable. Demonstrate movement, tap rotation and steerable fast fall; use a prepared board to show a break and attack; show one challenge objective and one reward choice; briefly introduce ranks, temporary bonuses, sword swaps, the build display, badges, score and saving. Use the player's mapped keys.

This is an introduction to every system in the sample, not a requirement to memorise every upgrade. Provide optional details where choices appear. Let a new player take longer without timing out. Tutorial state is separate from competitive runs and cannot grant farmable badge rewards or leaderboard scores.

## Delivery sequence and acceptance gates

| Milestone | Deliverable | Evidence before expansion |
| --- | --- | --- |
| 1. Encounter structure | Composed objectives, early completion, authored timing, deterministic endless segments and checkpoints | No impossible dependencies or forced ending at ten encounters; same seed/choices produce the same route and resume outcome |
| 2. Reward lifetimes | Ranked run effects, one-encounter bonuses and sword replacement | Exactly-once effects/grants; useful reward offers; ordinary duels unaffected |
| 3. Multiple opponents | Explicit targeting and real attack routing under a pressure budget | Queue/target/death edge cases; stable PC frame timing; winnable sample encounters |
| 4. Playable climb | Six templates, quick/rare events, bonus checkpoints, progression display and short tutorial | Several distinct builds reach the initial checkpoint targets; skilled play advances earlier; later generation remains bounded; tutorial covers the sample without blocking play |
| 5. Profile and recovery | Badge gallery, bounded permanent benefits, recoverable saves | Crash/refresh/two-tab/storage-failure checks; grants cannot duplicate; compatible older saves |
| 6. Verified competition | Score rules, personal bests and backend-validated seeded leaderboard | Farming tests, eligibility rules, replay verification, duplicate submission protection and comparable rule groups |

Existing save correctness is a release gate in every milestone; it must not wait for milestone 5. Prototype the score ledger early so achievements and scoring use shared events, but do not label a browser-only score as verified. Add content after the opening climb, checkpoint rewards and continuing progression work end to end. Public-service costs, accounts and hosting details need a concrete deployment proposal before introducing new services.

Each milestone should have its own implementable spec and focused tests. The engineering split should preserve the shared puzzle engine, separate encounter generation from encounter execution, centralise effect application and expose presentation through detached state and semantic events. Prefer small modules with deterministic inputs over embedding systems in the browser UI.

## Decisions still open

1. What failure model should a longer playthrough use? The existing default ends the run on defeat; changing that would need an explicit recovery design. Bonus rounds also need clear, separate failure stakes.
2. Which small permanent benefits should badges grant, and what is their combined cap?
3. Does the initial service need accounts/cloud saves, or should those arrive with verified public rankings?

The endless-climb direction and checkpoint-bonus concept are confirmed. These remaining choices can be resolved when their milestone is designed; they do not justify speculative implementation now.
