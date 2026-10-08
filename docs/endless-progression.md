# Your endless progression framework

Open Workshop → Endless progression, or Challenges → Endless survival → Edit
endless progression. Give stages your own names, start times and pressure.
Save applies to new endless runs; a run already in progress keeps its original
configuration. Two-minute runs use the fixed timed schedule. Everything is
stored in this browser; export JSON to keep a portable copy or edit elsewhere.

Each stage starts at its stated number of seconds and continues until the next
stage. The final stage repeats indefinitely. There is no hidden post-final
increase. The supplied numbered stages are a tuning scaffold, not a finished
progression design.

| Setting | Meaning |
| --- | --- |
| First attack | Seconds before the first scheduled wave, subject to variation |
| Interval variation | Seeded percentage variation around the interval |
| Start | Seconds from the start of actual play, excluding countdown/pause |
| Attack interval | Average seconds between queued waves |
| Swords | Number of simultaneous swords in that wave, from zero to three |
| Width and length | Sword dimensions in cells; final placement can convert or waste a sword under the engine rules |
| Sprinkles | Additional loose attack blocks in the wave |
| Starting/max breakers | Chance per block, with growth limited to five percentage points |
| Pairs until breaker cap | Indexed pair count where breaker chance reaches its cap |

Everyone receives the same seeded hazard batches on the same clock. Each batch
waits for that player's next placement; one batch is admitted per placement.
Consequently the same wave may physically land at different times. No attack
teleports into an actively falling pair. The interface distinguishes the next
scheduled wave from already queued waves, and gives the next stage's parameters.

An interval is chosen using the stage active after the preceding wave. The
attack payload uses the stage active at its own scheduled arrival. Crossing a
stage boundary therefore does not reschedule a wave already announced.

The checked sword pool supplies hazard patterns as well as player assignments.
The pool starts with only Falchion enabled. Each player keeps their assigned
pattern for the full game, including the paired-duel final. Names and actual
rows are snapshotted; changes to the pool apply to the next game.

Editable configuration lives in `dist/progression.js`; UI in
`dist/progression-editor.js`. `validateProgression` accepts only numeric finite
values within the editor's limits, one to twenty stages, a zero-second opening
stage, strictly increasing times and nonempty attacks. Imports pass the same
validation as saves. `progressionAt` returns current/next stage details;
`challenge.js` consumes that configuration to generate actual attacks and the
indexed breaker stream. Rules v3 local bests include the exact progression,
handling profile, difficulty and pattern pool. Changing balance starts a
separate best-score category without deleting previous results.

Possible ideas to fill in yourself:

- Stage names and theme: ____________________
- What each stage should teach/test: ____________________
- First meaningful pressure increase: ____________________
- Desired late-game difficulty: ____________________
- Preferred average survival time: ____________________

The current framework controls pressure and breakers. It does not implement
roguelite rewards, upgrades or branching progression.
