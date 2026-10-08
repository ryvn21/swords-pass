# AI and entry update

Bots now use distinct breaker, builder and counter styles at each difficulty.
They favour completed clears more, penalise buried breakers and dangerous
stacks, and simulate attack decay before resolving a candidate placement.
Medium and hard inspect more candidate next-pair continuations. Styles have
different clear/gem/chain weights and deterministic lane preferences, so three
bots using the same indexed pieces no longer intentionally play identically.

Workers run the main planner. If worker creation, execution or planning fails,
the UI uses a smaller one-pair planner instead of silently dropping every pair
in the spawn column. AI still obeys ordinary movement, rotation and fall rules;
there are no injected breakers or unearned attacks. These are improved puzzle
bots, not a claim of expert Puzzle Pirates play.

Three 180-second, hazard-free medium-bot simulations at seeds 771, 5329 and 90120
gave the following totals. This is a limited repeatable check, not a broad skill
ranking. The updated engine also adds entry space, so pair throughput differs.

| Version | Placed pairs | Cleared cells | Swords | Survival |
| --- | ---: | ---: | ---: | --- |
| Previous | 213 | 288 | 11 | One run ended at 163s |
| Updated | 177 | 307 | 15 | All reached 180s |

Engine v8 adds a two-cell visible entry area above the thirteen playable rows.
The new pair's pivot starts one row higher. Once a vertical pair enters a narrow
shaft it still flips its two colours in place. Column four remains the spawn
loss condition. Locking with a block outside the playable board loses instead
of silently discarding that block or advancing NEXT. The entry area is movement
space, not two additional storage rows.

Engine v7 was frozen in `legacy-engine-v7.js`. Existing versions 1–7 replay using
their original engines and old board framing; new recordings use v8. No older
recordings are migrated to the new spawn rules.

The shared timed attack schedule now starts around eight seconds with a sword
and sprinkles, rather than delaying sword eligibility until 110 seconds. Later
waves become more frequent. Exact timing and skill balance still need playtest
feedback. Endless is deliberately editable in the progression workshop.
