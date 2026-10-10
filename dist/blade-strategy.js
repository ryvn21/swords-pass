// How each blade wants to be played, from Ryan's notes (10 October 2026). The bots read this to pick a plan:
//   tier      1 (worst) .. 10 (best) overall strength
//   plan      pressure  fast, overlapping attacks that bury the rival before they can answer
//             burst     build up and land big strikes
//             sprinkle  lean on sprinkles
//             balanced  a bit of everything
//             defensive keep a clean board, attack when it's free
//             spam      attack as often and as fast as possible (the "just force it" plan for weak blades)
//   strike    0..1  how much its big strikes are worth
//   sprinkle  0..1  how much its sprinkles are worth
//   tempo     0..1  how much it prefers frequent small attacks over waiting for big ones
//   opener    the attack it most wants to open with ({w, h, sprinkles})
//   edgeWeak  strikes landing at the board's edges do little: favour the middle
// Blades without notes yet fall back to their family below or to 'balanced'.
export const BLADE_STRATEGY = {
  'sinners-saber': {tier: 10, plan: 'pressure', strike: .85, sprinkle: 1, tempo: .9, opener: {w: 2, h: 8, sprinkles: true}, edgeWeak: true,
    note: 'Smothers the rival with overlapping two-colour attacks. Huge middle strike, alternating sprinkles in four columns. Big corner strikes are weak; small corner strikes cut off the two colours with a third. Open with a 2x8+ and sprinkles; keep the pressure on so they never get the breaker they need.'},
  'saber': {tier: 8, plan: 'pressure', strike: .75, sprinkle: .85, tempo: .85, opener: {w: 2, h: 8, sprinkles: true}, edgeWeak: true, note: 'Sinner’s Saber, not as strong.'},
  'forgotten-falchion': {tier: 8, plan: 'burst', strike: .95, sprinkle: .3, tempo: .3, note: 'Best at big strikes; weak sprinkles.'},
  'falchion': {tier: 6, plan: 'burst', strike: .8, sprinkle: .3, tempo: .35, note: 'Forgotten Falchion, not as strong.'},
  'katana': {tier: 6, plan: 'burst', strike: 1, sprinkle: .1, tempo: .15, note: 'Big strikes are amazing; everything else is poor, sprinkles especially.'},
  'rapier': {tier: 4, plan: 'burst', strike: .7, sprinkle: .3, tempo: .3, note: 'Best at big strikes, but not very good.'},
  'cleaver': {tier: 4, plan: 'burst', strike: .65, sprinkle: .35, tempo: .35, note: 'Big hits are okay.'},
  'dadao': {tier: 5, plan: 'balanced', strike: .7, sprinkle: .55, tempo: .55, note: 'A mix of katana and saber, not great at either.'},
  'skull-dagger': {tier: 8, plan: 'sprinkle', strike: .45, sprinkle: 1, tempo: .75, note: 'The premium sprinkle sword.'},
  'short-sword': {tier: 6, plan: 'balanced', strike: .6, sprinkle: .6, tempo: .5, note: 'Good all-rounder.'},
  'cutlass': {tier: 4, plan: 'balanced', strike: .5, sprinkle: .5, tempo: .5, note: 'Low tier, balanced.'},
  'stiletto': {tier: 5, plan: 'balanced', strike: .6, sprinkle: .5, tempo: .6, note: 'Quick attacks and big attacks are both okay.'},
  'scimitar': {tier: 5, plan: 'defensive', strike: .55, sprinkle: .55, tempo: .4, note: 'Defensive; most attacks are decent but little kill pressure.'},
  'poniard': {tier: 3, plan: 'spam', strike: .4, sprinkle: .5, tempo: .85, note: 'Odd sprinkle pattern can confuse, but not strong. Quick, spammy play is best.'},
  'foil': {tier: 2, plan: 'spam', strike: .35, sprinkle: .3, tempo: .8, note: 'Bad. Either land something huge enough to kill or spam as fast as possible.'},
  'dirk': {tier: 2, plan: 'spam', strike: .35, sprinkle: .3, tempo: .8, note: 'Really bad; play it like the foil.'},
  'backsword': {tier: 2, plan: 'spam', strike: .35, sprinkle: .3, tempo: .8, note: 'Like the dirk and foil.'},
  'stick': {tier: 1, plan: 'spam', strike: .25, sprinkle: .25, tempo: .85, note: 'The worst sword, played like the foil. Great fun in stick-vs-stick games.'},
};
export const DEFAULT_STRATEGY = {tier: 5, plan: 'balanced', strike: .6, sprinkle: .5, tempo: .5};
// edge strikes are weak for everyone (spammy); pressure blades care most
export const strategyFor = id => ({...DEFAULT_STRATEGY, edgeWeak: true, ...(BLADE_STRATEGY[id] || {})});
