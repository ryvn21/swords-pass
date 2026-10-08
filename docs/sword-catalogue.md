# Sword catalogue

Reference: https://ypp.mantid.org/swords/ captured 6 October 2026.

The rack includes the 17 named swords in the user's screenshot, Custom, and the
Sinner's Saber and Forgotten Falchion. Ember, Tide and Moss are no longer
selectable. A saved selection of a removed sword migrates to Forgotten Falchion;
old replay snapshots still contain their original attack patterns.

`dist/swords.js` holds the reference matrices and enamel lookup. The captured
source fixture is `tests/fixtures/mantid-swords.json`. Source rows run top to
bottom; engine rows run bottom to top. Primary (guard) colours Green, Blue and
Purple mirror columns. Stick always uses the Red/Red mapping. Legacy blades and
user-created patterns have fixed colour cells. Workshop opens to Sword patterns;
New pattern creates a separate 4-row draft. Saved patterns have stable IDs, names,
icons and independent matrices. Built-ins save edited copies; Delete removes a
custom pattern or hides a built-in. Undo deletion restores only that entry,
preserving later edits; Restore built-ins clears the hidden catalogue entries.
The old single custom slot migrates once, excluding the user-requested obsolete
custom named Forgotten Falchion. Other saved custom patterns are retained.

The selected matrix goes into both players' match states (the existing mirrored
AI loadout rule), then into outgoing attacks and replay snapshots. Sprinkles
alternate the bottom two rows. Long swords repeat the top four rows, or all three
for Stick. Horizontal attacks use the existing handed rotation of that matrix.
Combat version remains 7: rules are unchanged, and replays store complete pattern
matrices independently of catalogue corrections or deletions.

The ordinary Saber/Falchion entries follow the supplied Mantid data; they are not
claimed to be verified post-July-2024 live-game layouts. The source's Saber shape
may overlap earlier legacy variants. See the outdated-pattern warning at
https://yppedia.puzzlepirates.com/Swordfighting_drop_pattern .

Icons in `dist/sword-art.js` are original SVG illustrations, with distinct blade
and guard silhouettes and enamel colours. No external image requests are needed.

Validation: 82 unit/regression tests; all 17 source matrices at every one of the
64 enamel combinations; vertical, horizontal and sprinkle attack colours;
unchanged legacy fixtures; four deterministic AI matches; Chrome desktop/mobile
selection, all 20 previews, colour persistence, both duel loadouts, replay
playback, custom save/reload, and no horizontal mobile overflow or page errors.

## User image corrections, 6 October 2026

The legacy entries now follow the latest user-supplied images. Input rows below
are top to bottom, before transformations (`R` red, `Y` yellow, `G` green, `B` blue):

- Sinner's Saber: `GBBRRG / GGYYGG / GGYYGG / GRRBBG / BRRBBB / BBBRRB`.
  Mirror left-right and simultaneously substitute R→G, B→Y, G→B, Y→R.
- Forgotten Falchion: `GGYYBB / GBYRRB / RBBGRY / RRGGYY`.
  Mirror left-right; no colour substitution.

The resulting top-to-bottom rows are independently asserted in
`tests/pattern-library.test.mjs`. Additional library tests cover migration,
independent saves/renames/deletion, built-in removal/restoration and validation.
Browser checks cover editor history, new/duplicate/save/delete, undo deletion
after later saves, import, persistence, corrected grids, clean enamel refresh,
unsaved draft preservation, mobile layout, and the explicit Freebuild entry
from practice. The suite now contains 87 passing tests.
