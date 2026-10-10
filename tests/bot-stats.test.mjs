import test from 'node:test';
import assert from 'node:assert/strict';
import {createBotStats} from '../server/bot-stats.mjs';
test('bot stats count duels, wins, best combo and fastest win; junk and floods are ignored', () => {
  const s = createBotStats({url: '', key: ''});
  assert.equal(s.report({bot: 'iron-maw', won: true, ms: 90000, chain: 4}, 'a'), true);
  assert.equal(s.report({bot: 'iron-maw', won: false, ms: 60000, chain: 6}, 'a'), true);
  assert.equal(s.report({bot: 'iron-maw', won: true, ms: 50000, chain: 2}, 'b'), true);
  assert.equal(s.report({bot: 'Bad Id!', won: true, ms: 50000}, 'a'), false);
  assert.equal(s.report({bot: 'iron-maw', won: true, ms: 500}, 'a'), false);
  const [b] = s.list(); assert.deepEqual([b.played, b.playerWins, b.bestChain, b.fastestWinMs], [3, 2, 6, 50000]);
  for (let i = 0; i < 400; i++) s.report({bot: 'pip', won: false, ms: 9000}, 'flood');
  assert.equal(s.list().find(x => x.id === 'pip').played, 300);
});
