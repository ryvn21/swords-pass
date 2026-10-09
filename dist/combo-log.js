// The combo log: one entry per combo (its size and everything it sent), with the individual
// steps summarised underneath, instead of one entry per break. Used by Play vs AI and online.
const NAMES = ['', 'Break', 'Double', 'Triple', 'Bingo', 'Donkey', 'Vegas'];
export const comboName = n => NAMES[Math.min(6, Math.max(1, n | 0))];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// A step is one break in the combo: {n: chain step, g: gems broken, s: [[width, length], …], p: sprinkles}
export function stepOf(e) { return {n: e.chain | 0, g: e.cleared?.length | 0, s: (e.swords || []).map(s => [s.width, s.length]), p: e.sprinkles | 0}; }

export function createComboLog({limit = 8} = {}) {
  const entries = [], open = new Map();
  let version = 0;
  const trim = () => { if (entries.length > limit) entries.length = limit; };
  return {
    entries, get version() { return version; },
    // a break by `who` (any key: a side number or a player id); a lower or equal step starts a new combo
    step(who, step, extra = {}) {
      let c = open.get(who);
      if (!c || step.n <= c.chain) { c = {who, chain: 0, steps: [], live: true, ...extra}; open.set(who, c); entries.unshift(c); trim(); }
      c.chain = step.n; c.steps.push(step); version++; return c;
    },
    // the combo is over (the pair after it spawned, or its batch went out)
    close(who, extra) { const c = open.get(who); if (!c) return null; open.delete(who); c.live = false; if (extra) Object.assign(c, extra); version++; return c; },
    // a finished combo reported whole (another player's, over the network)
    add(who, combo, extra = {}) { open.delete(who); entries.unshift({who, chain: combo.chain | 0, steps: combo.steps || [], live: false, ...extra}); trim(); version++; },
    clear() { entries.length = 0; open.clear(); version++; },
  };
}

// Everything the combo sent, with identical swords counted together.
export function comboTotals(c) {
  const swords = new Map(); let sprinkles = 0, gems = 0;
  for (const s of c.steps) { gems += s.g; sprinkles += s.p; for (const [w, l] of s.s) { const k = w + '×' + l; swords.set(k, (swords.get(k) || 0) + 1); } }
  return {swords: [...swords].map(([k, n]) => {const [w, l] = k.split('×').map(Number); return {w, l, n};}).sort((a, b) => b.w * b.l - a.w * a.l), sprinkles, gems};
}

// who: display name; mine: the viewer's own combo; to: optional target name (free-for-all)
export function comboHTML(c, {who, mine, to} = {}) {
  const n = Math.max(1, c.chain), tier = Math.min(6, n), t = comboTotals(c);
  const sent = [...t.swords.map(s => `<span class="sent-sword" style="--w:${s.w};--l:${s.l}">${s.w}×${s.l}${s.n > 1 ? `<i>·${s.n}</i>` : ''}</span>`), t.sprinkles ? `<span class="sent-sprinkle">${t.sprinkles}</span>` : ''].join('');
  const steps = c.steps.length > 1 ? `<ol class="chain-steps">${c.steps.map(s => `<li><b>×${s.n}</b>${s.g} gems${s.s.length || s.p ? ' → ' + [s.s.length ? s.s.map(([w, l]) => w + '×' + l).join(' ') : '', s.p ? s.p + ' spr.' : ''].filter(Boolean).join(' + ') : ''}</li>`).join('')}</ol>` : '';
  const enter = !c.shown; c.shown = true;
  const verb = c.live ? 'building' : sent ? 'sent' : '';
  return `<div class="chain-entry tier-${tier} ${mine ? 'mine' : 'theirs'}${c.live ? ' live' : ''}${enter ? ' enter' : ''}"><b class="chain-n">${n > 1 ? '×' + n : '•'}</b><div><strong>${esc(comboName(n))}</strong><small>${esc(who)}${verb ? ' ' + verb : ''}${to && !c.live && sent ? ' → ' + esc(to) : ''}</small><div class="chain-sent">${sent || `<span class="sent-none">${c.live ? '…' : 'nothing sent'}</span>`}</div>${steps}</div></div>`;
}
