# Score challenges, rules v3

Solo or a four-board free-for-all against Pip, Marlow and Rook. The two-minute
mode ends at 120 seconds or when all boards are out; endless ends when all are
out. Scores freeze on elimination. Highest score wins, including eliminated
players; equal scores share a rank. No player-targeted attacks in these modes.

Each completed clear scores `(10 * blocks + 5 * max(0, blocks - 4)) * comboStage`.
A clear still animating at the two-minute cutoff has not completed and scores
nothing. Attacks that replace pieces do not score. Engine v8 adds a visible entry area; old replays retain their original engines.

`dist/challenge.js` owns deterministic run state. Every contestant has an isolated
practice match, with the same seed and the user's saved handling profile. A shared clock
queues an independent copy of each generated hazard for every living player,
due at their next lock. Existing engine batch handling admits one queued hazard
per placement. Board differences can change where identical attacks land.

Breakers increase from 25% to 28% over the first 100 indexed pairs, then stay at
28% by default; endless can configure its start, cap and pair ramp. The increase follows sequence position rather than wall-clock spawn time:
this preserves the exact same pairs for different player speeds and keeps the
NEXT preview stable. No changes to existing duel breaker rates.

The first wave arrives at about eight seconds (seeded ±12% variation) and
contains a sword plus sprinkles. Stage intervals start at 12 seconds, then
10 seconds at 30s and 8 seconds at 60s. Timed play retains this standard
schedule. Endless reads the player's editable framework: see
[Your endless progression framework](endless-progression.md).

The checked pattern pool supplies player assignments and shared hazard
patterns. Only Falchion is enabled initially. The pool is snapshotted when
the run starts and does not affect the common pair sequence.

Three updated endless AI simulations (seeds 771, 5329, 90120) ended at 129,
130 and 138 seconds. The stronger starter pressure is provisional and
currently shorter than the earlier 3–5 minute aspiration. The progression
editor allows the owner to set a gentler or longer curve without code changes.

`dist/challenge-ui.js` handles the separate run lifecycle, three AI workers,
custom key bindings, touch input, pause/visibility handling, standings, and
post-elimination spectating. Workers are terminated on exit/retry/end. Results
and personal bests persist locally by mode, player count, handling profile and
AI difficulty, exact progression and pattern pool. Bots use distinct styles
within the selected easy/medium/hard difficulty. Earlier v1/v2 history remains
visible, but its bests are separate. Seed + same-input
determinism is covered by simulation tests; local scores are not an online
verified leaderboard. Challenge replays and real networking are not part of v1.

Verification: shared hazards at each player's next turn; one batch per lock;
completed-clear scoring and combo bonuses; two-minute cutoff; eliminated-player
wins and ties; stable pairs with capped breaker increase; browser AI turns,
pause/resume, finished timed run, same-seed retry, solo endless, saved scores,
navigation cleanup, and desktop/mobile layout.
