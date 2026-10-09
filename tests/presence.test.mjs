import test from 'node:test';
import assert from 'node:assert/strict';
import {createPresence} from '../server/presence.mjs';

test('presence counts each tab once by activity and forgets quiet ones', () => {
  let t = 0; const p = createPresence({now: () => t});
  p.report('tab-aaaaaaaa', 'online'); p.report('tab-bbbbbbbb', 'adventure'); p.report('tab-cccccccc', 'online');
  p.report('tab-aaaaaaaa', 'zen');   // moved on
  p.report('x', 'online'); p.report('tab-dddddddd', 'hacking');   // ignored
  let c = p.counts(); assert.equal(c.total, 3); assert.equal(c.by.online, 1); assert.equal(c.by.zen, 1); assert.equal(c.by.adventure, 1);
  p.report('tab-bbbbbbbb', 'gone'); t = 80000; p.report('tab-cccccccc', 'online');
  c = p.counts(); assert.equal(c.total, 1); assert.equal(c.by.online, 1);
});
