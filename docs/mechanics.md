# Mechanics evidence and calibration ledger

## Authoritative user clarifications — 10 September 2026

- Controls: Left/Right movement, Up counterclockwise, Down clockwise, Space accelerates a visible fall. Remapping is required.
- 2×2: single produces 1×4; double 2×4; triple 2×6.
- 3×3: single produces 2×4; double 3×6; triple 3×9.
- Sword impacts destroy/replace contacted pieces; they do not push the board upwards.
- Perfect standard AI duels before adding roguelite progression.
- Preserve old and new Saber/Falchion variants; legacy names are Sinner’s Saber and Forgotten Falchion. Current arrays remain unavailable from a distinct verified reference.

## References

1. [Swordfight](https://yppedia.puzzlepirates.com/Swordfight): board, controls, fusing, chain conversion, defeat condition and attack stages.
2. [Black Death placement guide](https://yppedia.puzzlepirates.com/Black_Death_Sword_and_Sprinkle_Placement_Guide): positional sequences, handedness, obstacle handling, horizontal placement and sprinkle rules.
3. [Drop-pattern mapping](https://yppedia.puzzlepirates.com/Swordfighting_drop_pattern): colour mapping and top-four-row repetition.
4. [Official instructions](https://yppedia.puzzlepirates.com/Official:Swordfighting): basic game intent and damage pieces.
5. [July 2024 release](https://yppedia.puzzlepirates.com/Release_2024-07-25): confirms changes to Saber and Falchion but does not supply arrays.
6. [Mantid pattern tool](https://ypp.mantid.org/swords/): inspectable numerical layouts. Its Saber/Falchion colour equivalence matches the older wiki diagrams, so it does not independently establish a distinct current pattern.

## Video samples inspected

- [OSL duel](https://www.youtube.com/watch?v=kFMfNDREeic): 00:30–00:50. Contact sheets plus 8 fps crops around 00:35–00:38. Shows steerable rapid fall, clearance followed by gravity, a 2×4 strike replacing the contacted cells, and later silver/translucent stages. This sample does not establish all timing constants or all penetration sizes.
- [Single view](https://www.youtube.com/watch?v=UYndWzvTBCQ): 00:04–00:12. Lobby countdown, match entry and opening pieces.
- [Additional example](https://www.youtube.com/watch?v=CDlzeSNKjQg&t=364s): 06:04–06:12. This segment is a between-game challenge/lobby flow, not a chain demonstration.
- [Additional video](https://www.youtube.com/watch?v=S_2LCjcZTwQ): supplied; not yet frame-calibrated.

Only bounded excerpts were inspected, not the complete videos.

## Implemented and covered by tests

The engine separates board resolution from UI and stores deterministic input ticks. Shared attack indices govern both players. Tests cover the documented empty-board sequences; protection of column four; forced centre placements; full wastage; fused-gem obstruction; horizontal entrance and half-wastage conversion; sprinkle side, layering and protected height; colour-pattern repetition; gravity and chains; decay; legal AI controls; and exact replay reproduction.

Each player draws the same indexed pair stream at their own pace. This guarantees parity between boards within Scraps. It does not imply that the RNG algorithm matches the original game.

## Provisional rules — do not claim exact parity

| Area | Current implementation | Remaining evidence |
|---|---|---|
| Natural and fast fall | 800 ms and 200 ms per row; configurable | Measure input-to-motion and fall speed over uncut footage |
| Landing | 350 ms lock delay, successful grounded moves/rotations reset it up to six times | Verify lock reset and rapid-drop behaviour on contact |
| Rotation | Pivot around lower starting piece; simple horizontal/up kicks | Tight wells, reversals, floor and ceiling edge cases |
| Breaker frequency | Independent 25% chance per tile | Original randomization, drought rules and pair constraints |
| Gem overlap priority | Preserve existing rectangles; largest valid expansion wins | Ambiguous simultaneous rectangle formation |
| Incoming timing | One completed-move batch per receiver lock; current clear/cascade finishes before shared arrival; decay at lock | Same-frame ordering and original attack grace remain provisional |
| Clear order | Connected break wave (85 ms/edge), 180 ms per-cell fade, 50 ms cascade rows; chain sprinkles aggregated | Multiple same-frame breakers and incoming interactions |
| Vertical penetration | Width 1: one cell. Wider: contact plus ceil(length/4), capped at four rows | The sampled 2×4 impact supports two contacted rows; other lengths remain a hypothesis derived from user examples |
| Horizontal impact | Replace the swept cells; fused gems and intact swords obstruct | Exact loose-piece penetration and fallback order |
| Pressure escalation | No hidden late-match attack scaling | Determine whether/how original attacks grow over time |
| AI | Legal placement search, one visible next pair, difficulty pacing | Deliberate breaker stacking, deep setups, human strategy and timing |

When changing mechanics, add a concrete fixture for the user-observed case and check full replay determinism. Incompatible simulation changes require a replay version change; do not silently play old recordings against different rules.

## Pattern transcription

Rows are stored bottom to top, columns left to right. Colour indices: red 0, yellow 1, green 2, blue 3. The legacy pattern cells are transcribed from the wiki diagrams, then structurally compared against Mantid's arrays under colour permutation. No proprietary image assets are included in `dist`.

## 3 October 2026: supplied recording study

Source: `D:/Videos/streamlabs vods/2026-09-26 18-02-13.mp4` (132.15 s, 1920x1080, 60 fps). Overview sampled across the whole recording; duel action is in roughly the first 26 seconds, with lobby activity afterwards. Duel sampled at 2 fps, with 10 fps detail at 1.4–3.8 s and 10.8–13.2 s. This is frame inspection, not input telemetry.

| Timestamp | Visible observation | Change / confidence |
|---|---|---|
| 1.4–3.3 s, right board | Blue breaking propagates down the connected group; the surviving green tile remains suspended until clearing finishes, then falls | Progressive connected wave and separate settling phase. Sequence observed; exact per-edge delay is an estimate |
| 3.4–3.8 s, right board | Silver sword enters above the pile and travels downward | Dedicated attack travel phase; impact feedback on arrival |
| 4.4–4.9 s, right board | Sprinkles appear above the board then fall into separate columns | Incoming sprinkles animate from above instead of appearing at their destinations |
| 11.4–12.6 s, left board | Large sword enters, remains intact, then becomes grey cells after another placement | Preserve decay stages; animate entry separately from settling |
| Throughout duel | Cells are about 49 px wide by 72 px high; next pair is vertical | 32x48 logical rendering cells (2:3 ratio), vertical next preview; original artwork |

Version 2 changes simulation timing and delays incoming batches until the current clear/cascade ends. The latter fits the visible sequences but remains a scheduling hypothesis, not proof of every network/turn edge case. Old version-1 replays dispatch to a frozen version-1 engine. New replays use version 2. Custom timing preferences survive migration; unchanged first-build defaults receive the new cadence.

The recording does not establish key-down/release times, all penetration sizes, rotation kicks, RNG, or a tournament strategy model. No new penetration formula or AI-strength claim is derived from it. Natural fall remains provisional. No video frames, reference art, or temporary analysis dependencies are shipped.

Validation includes regression tests for wave traversal, simultaneous fused-gem breaking, staged split pairs, clear-before-attack ordering, renderer direction/fade, both replay versions, and deterministic full matches. Local Chrome interaction checks cover duel start, held fast fall, movement, AI worker, pause and responsive widths; they are not exhaustive manual playtesting.

## 3 October 2026: handling feedback

User reported high-stack rotation apparently replacing the active pair, unsteerably fast drop, and scarce/hard-to-see breakers. Reproduced two bugs: engaging fast fall after 500 ms of natural fall jumped 11 rows in one simulation tick; successful high-stack rotation at lockMs-1 locked the pair on that same tick.

Version 3 preserves the fractional row position when changing fall speed, clears blocked fall accumulation, refreshes the contact timer on successful moves/rotations (six resets per pair maximum), slows fast fall from 45 to 95 ms/row and raises lock time from 100 to 220 ms. Breakers now have a wider, bright-outlined blade and modest halo; default independent chance increases from 20% to 25%. These are user-directed feel adjustments, not measured claims about the original game. Untouched saved defaults migrate; explicit custom timings are retained. Version-1 and version-2 replays keep their frozen simulation engines.


## 3 October 2026: enclosed spawn column and frame measurements (version 4)

Exact regression: columns 1, 2, 3, 5 and 6 filled through row 13; column 4 empty. A counterclockwise or clockwise rotation previously accepted an upward kick placing BOTH blocks in hidden row 14. Lock then discarded both blocks, incremented the turn and dealt another pair. Legal positions now require at least one visible block. Rotation in this enclosed shaft is rejected, preserving the falling pair and NEXT. Valid one-block-hidden spawns remain legal. This fixes a separate cause from version 3's premature contact locking.

Frame inspection uses decoded 60 fps frames, colour masks and the known cell pitch. Coordinates are image pixels; times are approximate source-relative timestamps. These observations do not reveal held keys or original engine constants.

| Source / sample | Measured image motion | Interpretation |
|---|---|---|
| Supplied September 26 recording, left red block, 0.583–0.733 s | Upper red band moves y125 to y134: 9 px / 150 ms; row pitch about 72 px | Endpoint estimate 1200 ms/row; short, quantized natural-fall sample |
| Same recording, left yellow breaker, 1.317–1.467 s | Lower yellow band moves y181 to y190: 9 px / 150 ms | Another roughly 1200 ms/row endpoint sample; frame holds make exact calibration unjustified |
| Same recording, 0.733–0.750 s | Red band jumps y134 to y404 in one frame | 3.75 rows in <=16.7 ms. Cannot infer a continuous controllable fast-fall rate from this discontinuity; spectator/network presentation remains unconfirmed |
| Original single-view YouTube example, cached excerpt 4.733–5.100 s | Blue upper band y85 to y403: 318 px / 367 ms, approximately 48 px/row | Approximately 55 ms/row visible fast descent. Capture/playback timing and input state are unknown; this is not proof of the engine constant |
| September 26 opening drop, 0.75–about 1.10 s | Pair stays on the stack before its unsupported half separates | Approximately 350 ms visible contact interval; does not establish the exact lock-reset rule |

New defaults: natural 1000 ms/row, fast 125 ms/row, contact 350 ms. The natural/contact values are informed by these observations, while the deliberately slower fast fall responds to the user's feedback. ALL remain configurable tuning choices, not a claim of exact Puzzle Pirates parity. The footage does not justify relabelling 125 ms as measured fast fall. Untouched version-3 timing defaults migrate; custom values survive. Version-3 replays use the byte-identical frozen version-3 engine, including historical bugs, so old input logs remain reproducible.

Visual changes use original vector art: four distinct sword silhouettes, saturated red/yellow/green/blue, dark outlines, solid tile embossing and standalone cutout breakers. Removed the pale glow and tinted breaker backing. Breaker probability is unchanged at 25%; frequency is still provisional.

Validation: 57 automated tests, four deterministic AI matches with replay hashes, independent code review, and local Chrome interaction checks covering the actual enclosed column with repeated Up, steerable fast fall, default migration/custom preservation and desktop/mobile overflow. No reference frames or analysis dependencies are deployed.

## 3 October 2026: restore narrow-gap flipping (version 5)

Version 4 prevented the queue reroll but also rejected all rotation in a one-column shaft. Corrected behavior: when a vertical pair cannot complete a quarter-turn using the ordinary kicks, either rotation key flips the current two blocks within their existing cells. The pivot moves to the partner's cell and orientation changes 180 degrees; pair identity, breaker identity, NEXT and occupied coordinates are preserved. Ordinary quarter-turns retain priority whenever they fit.

The ceiling guard remains. The six-reset lock cap compares the lowest occupied cell rather than the pivot, so an in-place flip remains available after the cap without allowing the pair to climb or extending the lock timer. Version-4 replays use a frozen version-4 engine. Speeds and artwork are unchanged.

Regression coverage includes ceiling/middle/floor shafts at both board edges and column 4, both orientations and rotation directions, two flips restoring the original state, lock after the reset cap, AI consideration of both block orders and version-4 replay compatibility.


## 3 October 2026: steady motion and tap rhythm (version 6)

User feedback: motion feels laggy and accelerates abruptly, rotation taps interrupt rhythm, and the next-pair handoff is clunky. They explicitly want individual taps, not held-key rotation repeat.

Fixed renderer behavior: essential falling-pair movement remains fractional with reduced effects enabled (previously it snapped whole rows); drawing uses the remaining fraction of the fixed simulation tick so high-refresh displays need not repeat 60 Hz positions. Incoming pieces now travel linearly instead of using quadratic acceleration. Settling and attack travel also remain animated when decorative effects are reduced. The underlying active-pair descent already used a constant velocity within each mode; it did not have an acceleration curve.

New configurable defaults: natural fall 800 ms/row, Space 200 ms/row (4x instead of 8x), entry 60 ms. These are feel adjustments, not measured original-game constants. Fractional progress survives switching speeds. Unchanged prior defaults migrate; explicit custom values remain. No-op settling no longer adds an idle 50 ms pause. Actual gravity/clear/attack sequencing is retained. A rotation tap during the short entry phase is remembered once and applied to the next spawn; multiple such taps retain the latest direction. Taps during clearing/attack phases are not queued. Holding a rotation key still does not repeat.

The board footer now shows Best combo. Results explicitly say pairs placed and swords sent; the sidebar says Pairs / minute. Best combo uses the existing maximum chain multiplier, without changing scoring. Unchanged HUD text is no longer replaced every frame.

Validation includes local Chrome tests with decorative effects both on and off: eight repeated Up taps while holding Space all registered, maximum observed input-to-simulation delay 15 ms; held rotation did not repeat; entry-buffered rotation applied once. These local timings do not guarantee identical performance on the user's browser. Automated tests cover smooth per-mode travel, intermediate render frames, linear incoming motion, entry handoff, narrow-gap flipping and replay compatibility. Frozen v5 preserves prior simulation timing and behavior.


## 6 October 2026: attack batches (version 7)

User clarified that one move/turn produces one attack, attacks queue, and two or more swords may arrive together. One sword from each combo stage can participate; same-stage extras are permitted only when the full resulting attack does not fill the top of column 4. On follow-up the user explicitly confirmed that rejected extras are discarded, not postponed, and that lethal means the actual top cell of column 4 being filled rather than merely three swords covering the width.

Swords now retain their combo-stage number while accumulating through the attacker's complete chain. Final resolution enqueues one packet containing these swords and the accumulated sprinkles. The defender removes only the oldest eligible packet per lock. Any later packets wait for later turns; the defender's current clears and cascades still finish before the selected packet arrives.

Placement remains deterministic and ordered, using the existing handedness, column-4 avoidance, obstruction and wastage rules. Selection reserves the first generated sword of each stage, then tries additional same-stage swords in generation order against the complete ordered batch. A trial that fills row 13 of column 4 is rejected. This includes extras that would force a later primary sword into that cell. Rejected extras are discarded at receipt, retain their already-assigned pattern indices, and never re-enter the queue. Primary swords can be lethal, or fail to fit normally; three swords are not forced to fit or forced to kill. Choosing the first sword and retaining consumed indices are deterministic implementation policies, not independently proven original-game tie-break rules.

Selected components share one attack timer and render together over the same pre-impact board. Placement calculations are sequential to preserve sword obstruction, while visual arrival and hit events complete together. Legacy v6 replays use the frozen sequential-attack engine and the renderer accepts their single-hit visual state.

Validation: 77 tests pass, including a real two-stage clearing fixture, one-batch-per-turn queueing, shared hits, single/double/bingo primary swords, safe extra swords, unsafe-extra discard based on the defender's stack, and full-batch lookahead. Four complete AI matches reproduce their replay hashes. Local Chrome QA verifies two swords visible in the same animation, the next batch remaining queued, accurate incoming counts and no browser errors. Independent review found no actionable issues.
