# Bot encounters and repeatable upgrades

Scope: first one-opponent solo-run fights and clearly ranked, reusable upgrades. Preserve the approved 125 ms spawn adjustment setting and the user's handling profile. No multi-opponent targeting, cross-run progression, shops, sword equipment progression or one-encounter consumables yet.

## Implementation plan

1. Preserve the published run-v1 engine/content for existing saves. Current runs become version 2; saves select the correct run implementation. Add compatibility fixtures before changing behavior.
2. Extend encounter definitions with `kind: duel`, an authored opponent (name, difficulty, style, cadence), and `objective: defeat`. Keep existing survival/block/score encounters supported. Both players use real boards and attacks; no random hazards in duels. Defeat wins over a same-tick victory; a timeout fails the encounter.
3. Add a bounded deterministic bot controller, using existing placement evaluation with fixed simulation-tick thinking/action schedules. Human upgrades cannot change the bot's breaker probability. Bot decisions are reproduced on save reconstruction.
4. Add a narrow outgoing-attack hook to the base step function. The hook is absent in standard modes; their state hashes must remain identical. Run-only transformations happen once, on the complete outgoing batch, before a recipient can consume it in the same tick.
5. Reuse additive upgrade definitions at ranks 1–3. Add `sprinkleBonus` and `strikeHeightBonus`, alongside existing clear/chain/breaker bonuses. Sprinkle bonuses add once per non-empty outgoing attack. Height bonuses affect vertical swords only; cap narrow swords at 6 and wider swords at 13 without shrinking existing larger attacks. Incoming enemy attacks are unchanged. Existing wave-delay rewards remain usable in wave campaigns.
6. Show the opponent board and attack queue, outcome and difficulty. Reward cards show rank and current → next effective values. Keep art and presentation simple for Claude.
7. Test real exchanges, high-stack/same-tick ordering, modifier isolation and caps, rank progression, old/new save continuity, deterministic AI and UI pause/resume. Run browser QA and update Claude's integration contract before publishing.

## Provisional sample content

Suggested run: three single-opponent fights, easy → faster easy → medium, each capped at three minutes with rewards between fights. The authoring schema supports a one-fight route too. Using the suggested three-fight route as the provisional starting point; content remains authored and replaceable.

## Verification focus

- No effect leaks into bots or normal duels.
- A generated attack can be received in the same tick, so transform before enqueue.
- Both players/AI pause and resume together; no extra plan after death.
- Upgrades apply exactly once and produce the same output after replay.
- Save-v1 and its survival content retain original behavior and hashes.
- Full run simulations establish winnability, not final balance or exact original-game feel.

## Completed implementation and checks

- Run version 2, frozen v1 compatibility, two live boards, tick-based bot, rank previews and two outgoing attack effects implemented.
- Approved spawn pause stays 125 ms, with captured custom handling preserved.
- Full regression suite, JavaScript and asset checks passed. Desktop/mobile browser checks covered controls, both boards, pause, save/reload, invalid imports, quota failure/export, reward persistence and completion.
- Seeded autoplay: seeds 42 and 771 completed all three bot encounters; seed 7 reached the first encounter deadline. These establish functional outcomes, not final difficulty calibration.
- Independent read-only review found no actionable defects.
- Ruling: upgrades last for the current run. Cross-run persistence, multi-opponent fights and next-encounter consumables need their own scoped design before implementation.
