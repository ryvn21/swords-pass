# Roguelite direction — discussion notes, not an implementation specification

Owner feedback, 7 October 2026: likes the rough solo concept and wants to explore increasingly difficult challenges. Explicit constraint: **do not jump ahead**. Keep visual direction and authored detail with Claude/the owner.

## Proposed encounter direction

- Begin by fighting one easy bot.
- Later challenges may involve multiple bots and stronger bots.
- Some challenges may also require a score or a particular performance target.
- This would extend the current solo survival/objective sample with opponent encounters. The existing foundation does not implement those encounters yet.

## Upgrade examples from the owner

- Hit more opponents with an attack.
- Add one sprinkle to each outgoing attack.
- Double sprinkles for the next encounter.
- Double strike height for the next encounter.
- Add one strike-height unit permanently.
- Equip a different sword to improve attacks against opponents.
- Bonuses can have different lifetimes: next encounter and permanent. The meaning of permanent (current run or across runs) is still being clarified.

## Engineering implications to discuss before implementation

- Opponent encounters need explicit target selection, attack routing, simultaneous defeat handling and a victory condition for multiple opponents.
- Temporary effects need a stated activation and expiry boundary. “Next encounter” should survive save/load and should not be consumed just by opening a briefing.
- Attack modifiers should be applied in one documented place, with a defined order, caps and rounding. Do not silently change the base gem-to-sword conversion rules to implement an upgrade.
- Sword colour patterns and additional attack-size/quantity bonuses are distinct mechanics. A different sword pattern can change pressure without automatically increasing raw attack size.
- Defeat an opponent and reach a score could mean both conditions are required, or a bonus objective. This remains open.
- No decisions yet on permanent progression, lives/health, upgrade economy, difficulty curve, target selection or final content balance.

## Next useful scope, when requested

Agree the rules for one easy-bot encounter and its completion condition first. Prove that within a solo run before adding multiple opponents or the full modifier catalogue.

No gameplay expansion is authorized by these notes alone.
