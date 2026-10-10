import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommunity} from '../server/community.mjs';
import {publicId} from '../server/scores.mjs';

const rows = [[0, 1, 2, 3, 0, 1], [1, 2, 3, 0, 1, 2], [2, 3, 0, 1, 2, 3]];
const pid = 'abcdefghijklmnop', other = 'zyxwvutsrqponmlk';

test('community: share, list newest and most copied, copy counts, only the author removes', () => {
  const c = createCommunity({url: '', key: ''});
  const a = c.share({pid, author: 'Ry', name: 'Thornfang', iconId: 'foil', rows}, '1.1.1.1');
  assert.ok(a.ok); assert.equal(a.blade.authorId, publicId(pid)); assert.equal(a.blade.pid, undefined);
  const b = c.share({pid: other, author: 'Bo', name: 'Second', iconId: 'nope!', rows: rows.map(r => [...r].reverse())}, '2.2.2.2');
  assert.ok(b.ok); assert.equal(b.blade.iconId, 'custom');
  assert.deepEqual(c.list().map(x => x.name), ['Second', 'Thornfang']);
  c.use(a.blade.id); c.use(a.blade.id);
  assert.deepEqual(c.list({sort: 'popular'}).map(x => [x.name, x.uses]), [['Thornfang', 2], ['Second', 0]]);
  assert.equal(c.remove(a.blade.id, other), false);
  assert.equal(c.remove(a.blade.id, pid), true);
  assert.deepEqual(c.list().map(x => x.name), ['Second']);
});

test('community: refuses bad patterns, offensive names, copies of someone else’s pattern, and too many shares a day', () => {
  const c = createCommunity({url: '', key: ''});
  assert.equal(c.share({pid, name: 'x', rows: [[9]]}).ok, false);
  assert.equal(c.share({pid, name: 'n1gg3r blade', rows}).ok, false);
  assert.equal(c.share({pid, name: '', rows}).ok, false);
  assert.equal(c.share({pid: 'short', name: 'Fine', rows}).ok, false);
  assert.ok(c.share({pid, name: 'Fine', rows}, 'a').ok);
  assert.equal(c.share({pid: other, name: 'Copycat', rows}, 'b').ok, false);
  assert.ok(c.share({pid, name: 'Fine again', rows}, 'a').already);
  let n = 1; const r = i => [[i % 4, 0, 0, 0, 0, 0], [0, (i >> 2) % 4, 0, 0, 0, 0], [0, 0, (i >> 4) % 4, 0, 0, 1]];
  for (let i = 1; i < 20; i++) if (c.share({pid, name: 'B' + i, rows: r(i)}, 'a').ok) n++;
  assert.equal(n, 8);
});
