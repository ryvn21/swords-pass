# Paired duels and handling

Four-player paired duels are local play against three AI. The selected easy,
medium or hard difficulty applies to all three, using the existing Pip, Marlow
or Rook decision profile respectively. Their names remain distinct identities.
They obey the same saved fall/lock rules as the human. This is not online
matchmaking or a claim of Puzzle Pirates timing parity.

A seeded shuffle creates two simultaneous reciprocal pairings. Each duel uses
the standard engine, so complete combo batches go only to the matched opponent
and the existing one-batch-per-placement and same-stage safety rules apply.
There are no procedural hazards. The first surviving winner waits with their
board frozen until the other duel finishes. Two survivors enter a final with
their boards, active pieces, piece indices and ongoing clear resolution intact.
Queued attacks, buffered rotations and outgoing pending attacks from the old
duel are discarded. Attacks already painted on the board remain. Incoming
travel changes to settling. Attack identifiers continue above both prior
matches' counters to avoid collisions with existing sword cells. A countdown
precedes the final. Winner selection handles one or both opening duels drawing.
The user can spectate after elimination, retry the seed, or start a new match.
Local win/played records are separated by AI difficulty. Paired-duel replays
and online results are not implemented.

`handling-profile.js` validates and snapshots the saved profile for new runs.
Practice, ordinary duels, paired duels and challenges use the same saved
timings. A settings change applies to the next run, never silently changes a
live match or replay. Input repeat uses that run's snapshot too. Engine v7 and
legacy replay engines are unchanged. Presets are tuning starting points:

| Preset | Natural ms/row | Fast ms/row | Landing ms | Entry ms |
| --- | ---: | ---: | ---: | ---: |
| Relaxed | 1000 | 250 | 400 | 80 |
| Balanced | 800 | 200 | 350 | 60 |
| Brisk | 650 | 150 | 300 | 50 |

The settings UI includes exact numeric inputs, sliders, rows-per-second
feedback and a focusable live practice board. Slow and fast descent are both
uniform within their mode, using the engine's existing fractional-progress
handling; no time-based acceleration was added. Slowdown still needs user
assessment and eventual reference calibration. Reducing milliseconds speeds
up motion. Zero lock/entry delays are supported; non-finite values are rejected
and fast fall cannot be slower than natural fall.

Challenge rules v2 accept the same handling profile and selectable AI
difficulty. Scores/bests use a new identity including timing profile and
difficulty, so easier handling cannot overwrite a prior standard-speed best.
Old history remains visible. Shared hazards, per-index breaker growth, scoring
and timed/endless termination retain their existing meaning. Engine v7 replay
recordings retain their saved rules without profile normalization.
