// Play vs AI: the rivals, easiest first. Each has a strength tier (bot.js tierParams), a style (bot.js STYLES) and a
// home blade they bring unless you choose theirs. Tiers 11-12 are the ultras: faster than human hands.
export const ROSTER = [
  {id: 'pip', tier: 1, style: 'balanced', blade: 'stick', name: 'Pip', title: 'The deckhand', description: 'Still learning which end of the sword is which. Slow, kind, forgetful.'},
  {id: 'barnaby', tier: 2, style: 'rusher', blade: 'foil', name: 'Barnaby', title: 'The eager swab', description: 'Throws every little attack the moment he has it.'},
  {id: 'moss', tier: 3, style: 'builder', blade: 'cutlass', name: 'Moss', title: 'The tidy one', description: 'Likes neat blocks. Not in a hurry about it.'},
  {id: 'wren', tier: 4, style: 'wall', blade: 'scimitar', name: 'Old Wren', title: 'The patient wall', description: 'Keeps a clean board and waits for you to slip.'},
  {id: 'marlow', tier: 5, style: 'builder', blade: 'rapier', name: 'Marlow', title: 'The block builder', description: 'Builds big rectangles, then cashes them in.'},
  {id: 'juniper', tier: 6, style: 'chainer', blade: 'short-sword', name: 'Juniper', title: 'The combo setter', description: 'Lays down colours in tiers and lets one breaker do the rest.'},
  {id: 'rook', tier: 7, style: 'counter', blade: 'falchion', name: 'Rook', title: 'The counterpuncher', description: 'Reads what you send and answers harder.'},
  {id: 'vesper', tier: 8, style: 'rusher', blade: 'skull-dagger', name: 'Vesper', title: 'The sprinkler', description: 'Buries your board in sprinkles and never lets up.'},
  {id: 'hale', tier: 9, style: 'builder', blade: 'katana', name: 'Captain Hale', title: 'The executioner', description: 'Waits for the one big strike that ends it.'},
  {id: 'widow', tier: 10, style: 'rusher', blade: 'sinners-saber', name: 'The Widow', title: 'The smotherer', description: 'Overlapping two-colour strikes until you can’t breathe.'},
  {id: 'iron-maw', tier: 11, style: 'chainer', blade: 'forgotten-falchion', name: 'Iron Maw', title: 'Ultra', description: 'Not a person. Sees every chain, presses twice a frame’s worth.', ultra: true},
  {id: 'leviathan', tier: 12, style: 'rusher', blade: 'sinners-saber', name: 'The Leviathan', title: 'Ultra', description: 'Reads instantly, moves every frame. Beating it is a story worth telling.', ultra: true},
];
export const rosterBot = id => ROSTER.find(r => r.id === id);
