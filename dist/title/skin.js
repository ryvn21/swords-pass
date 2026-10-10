// Playfield skin. render.js calls these hooks through globalThis.scrapsSkin when present; without
// it (Node tests, or if this file fails) the original drawing is used. Drawing only: positions,
// timings and game state are never touched.
//
// Sprites are drawn as clean vector shapes at the board's real on-screen pixel size (render.js
// sizes the canvas 1:1 with the screen) and cached per size, so engravings stay sharp at any zoom.
// Each colour keeps its own sword silhouette so colours stay readable without hue:
//   red = leaf blade, yellow = rapier, green = scimitar, blue = broadsword.
// Grey (stone) pieces carry the engraving of the colour they will become.
import './sfx.js';
import {strikeSprite} from './forge-art.js';

const RAMP = [
  ['#2a060b', '#5e111b', '#9a1e28', '#d43838', '#f2705c', '#ffc2ad'],   // red: garnet
  ['#4a2f06', '#8c5e0f', '#cf9b1c', '#f2cf28', '#ffe982', '#fff9dc'],   // yellow: topaz
  ['#082615', '#12512b', '#21813c', '#47bf56', '#8fe381', '#dcffcc'],   // green: emerald
  ['#07112b', '#102a63', '#1c509f', '#369dde', '#82cbf3', '#d8f3ff'],   // blue: sapphire
];
const STONE = ['#18171a', '#34323a', '#55525a', '#7d7980', '#a39fa3', '#cfcbc9'];
const GOLD = ['#3d250d', '#80531d', '#c8963f', '#ecc66c', '#fff0b8'];
const INK = '#0d0807';
const hasDom = typeof document !== 'undefined';
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return [c, c.getContext('2d')]; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

// ---------- the four engravings, in a 32 x 48 cell space ----------
function emblem(color) {
  const blade = new Path2D(), hilt = new Path2D(), ridge = new Path2D();
  hilt.arc(16, 6.3, 2.1, 0, Math.PI * 2); hilt.rect(15, 8, 2, 4.8);           // pommel and grip
  if (color === 0) {          // leaf blade, rounded bar guard
    hilt.roundRect(9.6, 12.4, 12.8, 2.1, 1);
    blade.moveTo(16, 14.4); blade.bezierCurveTo(20, 18.5, 20.6, 27, 18.7, 33); blade.lineTo(16, 41.8); blade.lineTo(13.3, 33); blade.bezierCurveTo(11.4, 27, 12, 18.5, 16, 14.4); blade.closePath();
    ridge.moveTo(16, 17); ridge.lineTo(16, 36);
  } else if (color === 1) {   // rapier, knuckle bow
    hilt.roundRect(11, 12.6, 10, 1.6, .8);
    hilt.moveTo(11.6, 13.2); hilt.bezierCurveTo(9.4, 11, 10.6, 6.6, 14.6, 5.6); hilt.lineTo(14.9, 6.9); hilt.bezierCurveTo(12.2, 7.8, 11.6, 10.6, 12.9, 12.6); hilt.closePath();
    blade.moveTo(15, 14.2); blade.lineTo(17, 14.2); blade.lineTo(17, 37); blade.lineTo(16, 42.4); blade.lineTo(15, 37); blade.closePath();
    ridge.moveTo(16, 16); ridge.lineTo(16, 38);
  } else if (color === 2) {   // scimitar, curled quillons
    hilt.moveTo(9.8, 15.2); hilt.quadraticCurveTo(10.4, 12.2, 16, 12.6); hilt.quadraticCurveTo(21.6, 12.2, 22.2, 15.2); hilt.lineTo(20.8, 15); hilt.quadraticCurveTo(20, 14.2, 16, 14.5); hilt.quadraticCurveTo(12, 14.2, 11.2, 15); hilt.closePath();
    blade.moveTo(14.6, 14.4); blade.lineTo(17.6, 14.4); blade.quadraticCurveTo(21.4, 27, 20.2, 41.6); blade.quadraticCurveTo(15.6, 29, 14.6, 14.4); blade.closePath();
    ridge.moveTo(16.2, 17); ridge.quadraticCurveTo(18.6, 27, 19.2, 36);
  } else {                    // broadsword, square guard
    hilt.rect(8.6, 12.3, 14.8, 2.4); hilt.rect(8.6, 11.2, 1.8, 4.6); hilt.rect(21.6, 11.2, 1.8, 4.6);
    blade.moveTo(12.6, 14.7); blade.lineTo(19.4, 14.7); blade.lineTo(19.4, 35.6); blade.lineTo(16, 41.8); blade.lineTo(12.6, 35.6); blade.closePath();
    ridge.moveTo(16, 17); ridge.lineTo(16, 36.5);
  }
  const all = new Path2D(); all.addPath(blade); all.addPath(hilt);
  return {blade, hilt, ridge, all};
}
const EMBLEMS = [0, 1, 2, 3].map(emblem);

// carved (intaglio) engraving: dark upper-left wall, recessed floor, bright lower-right lip
function engrave(g, e, r, {floor = r[1], wall = r[0], lip = r[5], lipA = .85, ridge = r[0]} = {}) {
  g.save(); g.translate(.75, .85); g.fillStyle = alpha(lip, lipA); g.fill(e.all); g.restore();
  g.fillStyle = wall; g.fill(e.all);
  g.save(); g.clip(e.all); g.translate(.7, .8); g.fillStyle = floor; g.fill(e.all); g.restore();
  g.save(); g.clip(e.blade); g.strokeStyle = alpha(ridge, .55); g.lineWidth = .7; g.stroke(e.ridge); g.restore();
}
function emblemTransform(g, uw, uh, s = .9) { const k = Math.min(uw / 32, uh / 48) * s; g.translate(uw / 2, uh / 2); g.scale(k, k); g.translate(-16, -24); }

// ---------- tiles ----------
// body: outline, vertical light, bevelled rim, recessed plate
// Piece finish (Settings → Pieces): shiny (cut facets, glints, glow), satin (softer light, no glints or glow),
// matte (flat colour, gentle edges). Sprites are cached per finish.
export const FINISHES = ['shiny', 'satin', 'matte'];
let finish = 'shiny';
const shine = () => finish === 'shiny' ? 1 : finish === 'satin' ? .45 : .15;
function body(g, uw, uh, r, {plate = true, rad = 4.6} = {}) {
  rr(g, .4, .4, uw - .8, uh - .8, rad + .6); g.fillStyle = r[0]; g.fill();
  const grad = g.createLinearGradient(0, 1, 0, uh - 1); grad.addColorStop(0, finish === 'matte' ? r[3] : r[4]); grad.addColorStop(.45, r[3]); grad.addColorStop(1, finish === 'shiny' ? r[2] : r[3]);
  rr(g, 1.5, 1.5, uw - 3, uh - 3, rad); g.fillStyle = grad; g.fill();
  g.save(); rr(g, 1.5, 1.5, uw - 3, uh - 3, rad); g.clip();
  g.fillStyle = alpha(r[5], .7 * shine()); g.beginPath(); g.moveTo(1.5, 1.5); g.lineTo(uw - 1.5, 1.5); g.lineTo(uw - 3.6, 3.6); g.lineTo(3.6, 3.6); g.lineTo(3.6, uh - 3.6); g.lineTo(1.5, uh - 1.5); g.closePath(); g.fill();
  g.fillStyle = alpha(r[1], .85); g.beginPath(); g.moveTo(uw - 1.5, uh - 1.5); g.lineTo(1.5, uh - 1.5); g.lineTo(3.6, uh - 3.6); g.lineTo(uw - 3.6, uh - 3.6); g.lineTo(uw - 3.6, 3.6); g.lineTo(uw - 1.5, 1.5); g.closePath(); g.fill();
  g.restore();
  if (plate) {
    const pg = g.createLinearGradient(0, 4, 0, uh - 4); pg.addColorStop(0, r[3]); pg.addColorStop(1, r[2]);
    rr(g, 4.4, 4.4, uw - 8.8, uh - 8.8, 2.4); g.fillStyle = pg; g.fill();
    g.strokeStyle = alpha(r[1], .55); g.lineWidth = .7; g.beginPath(); g.moveTo(4.6, uh - 4.6); g.lineTo(4.6, 4.6); g.lineTo(uw - 4.6, 4.6); g.stroke();
    g.strokeStyle = alpha(r[5], .45); g.beginPath(); g.moveTo(uw - 4.6, 5); g.lineTo(uw - 4.6, uh - 4.6); g.lineTo(5, uh - 4.6); g.stroke();
  }
}
function glint(g, x, y, s = 1) {
  g.fillStyle = '#ffffffe6'; g.beginPath(); g.moveTo(x, y - 2.2 * s); g.lineTo(x + .55 * s, y - .55 * s); g.lineTo(x + 2.2 * s, y); g.lineTo(x + .55 * s, y + .55 * s); g.lineTo(x, y + 2.2 * s); g.lineTo(x - .55 * s, y + .55 * s); g.lineTo(x - 2.2 * s, y); g.lineTo(x - .55 * s, y - .55 * s); g.closePath(); g.fill();
}
function seeded(n) { let s = n * 9301 + 49297; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function drawBlock(g, color, kind, uw, uh) {
  const stone = kind === 'stone', r = stone ? STONE : RAMP[color], col = RAMP[color];
  body(g, uw, uh, r);
  if (stone) {
    // freshly landed: plain grey stone, no hint of colour yet (it shows when the shell cracks)
    g.save(); rr(g, 4.4, 4.4, uw - 8.8, uh - 8.8, 2.4); g.clip(); g.strokeStyle = alpha(STONE[1], .9); g.lineWidth = 1; rr(g, 4.4, 4.4, uw - 8.8, uh - 8.8, 2.4); g.stroke();
    g.strokeStyle = alpha(STONE[1], .8); g.lineWidth = .8; g.beginPath(); g.moveTo(6, uh * .2); g.lineTo(9.5, uh * .3); g.lineTo(8.4, uh * .38); g.lineTo(11, uh * .46); g.moveTo(uw - 6, uh * .7); g.lineTo(uw - 9, uh * .78); g.lineTo(uw - 8, uh * .86); g.stroke();
    const rnd = seeded(5); g.fillStyle = alpha(STONE[4], .5); for (let i = 0; i < 9; i++) g.fillRect(5 + rnd() * (uw - 10), 6 + rnd() * (uh - 12), 1.2, 1.2);
    g.fillStyle = alpha(STONE[1], .6); for (let i = 0; i < 7; i++) g.fillRect(5 + rnd() * (uw - 10), 6 + rnd() * (uh - 12), 1.4, 1);
    g.restore(); return;
  }
  if (kind === 'decay') {      // waking: a grey shell cracking open on the colour beneath, one turn from free
    const sr = STONE; body(g, uw, uh, sr);
    const crack = new Path2D(); crack.moveTo(uw * .18, 1); crack.lineTo(uw * .62, 1); crack.lineTo(uw * .5, uh * .3); crack.lineTo(uw * .74, uh * .46); crack.lineTo(uw * .46, uh * .7); crack.lineTo(uw * .64, uh - 1);
    crack.lineTo(uw * .3, uh - 1); crack.lineTo(uw * .4, uh * .74); crack.lineTo(uw * .2, uh * .5); crack.lineTo(uw * .36, uh * .3); crack.closePath();
    g.save(); g.clip(crack); body(g, uw, uh, r); g.save(); emblemTransform(g, uw, uh); engrave(g, EMBLEMS[color], r); g.restore(); g.restore();
    g.lineJoin = 'miter'; g.strokeStyle = r[5]; g.lineWidth = 1.1; g.stroke(crack); g.strokeStyle = STONE[0]; g.lineWidth = .5; g.stroke(crack);
    rr(g, 1.6, 1.6, uw - 3.2, uh - 3.2, 4.4); g.strokeStyle = r[3]; g.lineWidth = 1.4; g.setLineDash([3, 2.5]); g.stroke(); g.setLineDash([]);
    return;
  }
  g.save(); emblemTransform(g, uw, uh); engrave(g, EMBLEMS[color], r); g.restore();
  // a cut facet across the upper corner: reads as a polished gem rather than a flat tile
  g.save(); rr(g, 1.5, 1.5, uw - 3, uh - 3, 4.6); g.clip();
  if (finish === 'matte') { g.restore(); return; }
  g.fillStyle = alpha(r[5], .55 * shine()); g.beginPath(); g.moveTo(1.5, uh * .2); g.lineTo(uw * .32, 1.5); g.lineTo(uw * .46, 1.5); g.lineTo(1.5, uh * .3); g.closePath(); g.fill();
  g.fillStyle = alpha(r[1], .5); g.beginPath(); g.moveTo(uw - 1.5, uh * .8); g.lineTo(uw * .68, uh - 1.5); g.lineTo(uw * .56, uh - 1.5); g.lineTo(uw - 1.5, uh * .7); g.closePath(); g.fill();
  g.restore();
  if (finish === 'shiny') { glint(g, 7.2, 7.4, .9); glint(g, uw - 7, uh - 9, .45); }
}
// Breakers: the free-standing blade lit from inside (no tile). Bold is the look in play; the others are
// kept for reference only:
//   classic: the original thin blade with a strong pulsing glow
//   steady:  a little bigger, a dark edge so it reads on any background, a soft glow that doesn't pulse
//   bold:    bigger and thicker with an ink outline; the glow breathes slowly and faintly
//   ember:   bold blade, no glow; a bright core line instead, so it still looks lit
export const BREAKER_STYLES = ['classic', 'steady', 'bold', 'ember'];
const BREAKER_LOOK = {
  classic: {scale: 1.12, ink: 0, edge: 2.2, ridge: 1.1, glow: {a: .2, amp: .16, r: .9, speed: 2.6}},
  steady: {scale: 1.22, ink: 2.6, edge: 1.6, ridge: 1.2, glow: {a: .1, amp: 0, r: .62, speed: 0}},
  bold: {scale: 1.34, ink: 3.4, edge: 1.8, ridge: 1.5, glow: {a: .07, amp: .05, r: .66, speed: 1.1}},
  ember: {scale: 1.34, ink: 3.4, edge: 1.8, ridge: 2.2, core: true, glow: null},
};
let breakerStyle = 'bold', nightGlow = 1;
function drawBreakerStyle(g, color, uw, uh, style = 'classic') {
  const L = BREAKER_LOOK[style] || BREAKER_LOOK.classic, r = RAMP[color], e = EMBLEMS[color];
  g.save(); emblemTransform(g, uw, uh, L.scale); g.lineJoin = 'round';
  if (L.ink) { g.strokeStyle = INK; g.lineWidth = L.ink; g.stroke(e.all); }
  g.strokeStyle = r[0]; g.lineWidth = L.edge; g.stroke(e.all);
  const grad = g.createLinearGradient(11, 0, 21, 0); grad.addColorStop(0, finish === 'matte' ? r[4] : r[5]); grad.addColorStop(.5, finish === 'matte' ? r[3] : r[4]); grad.addColorStop(1, finish === 'shiny' ? r[2] : r[3]);
  g.fillStyle = grad; g.fill(e.all);
  g.save(); g.clip(e.blade); g.strokeStyle = L.core ? r[5] : finish === 'shiny' ? '#ffffff' : r[5]; g.lineWidth = finish === 'matte' ? L.ridge * .6 : L.ridge; g.stroke(e.ridge); if (L.core) { g.strokeStyle = '#ffffff'; g.lineWidth = L.ridge * .45; g.stroke(e.ridge); } g.restore();
  g.strokeStyle = alpha(r[5], .9); g.lineWidth = .5; g.stroke(e.all);
  g.restore();
}
function drawBreaker(g, color, uw, uh) { drawBreakerStyle(g, color, uw, uh, 'classic'); }
// the light behind a breaker, drawn live (not part of the pixel sprite)
function breakerGlow(ctx, x, y, w, h, color, style, t) {
  const G = (BREAKER_LOOK[style] || BREAKER_LOOK.classic).glow; if (!G || finish !== 'shiny') return;
  const p = G.speed ? .5 + .5 * Math.sin(t * G.speed + color * 1.3 + x * .07) : .5;
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, x + w / 2, y + h * .55, w * G.r, RGB[color], (G.a + G.amp * p) * nightGlow); ctx.globalCompositeOperation = 'source-over';
}
function drawGem(g, color, uw, uh) {        // fused rectangle: one large faceted stone
  const r = RAMP[color];
  body(g, uw, uh, r, {plate: false, rad: 5.5});
  const b = Math.min(7, Math.min(uw, uh) * .16), x0 = b, y0 = b, x1 = uw - b, y1 = uh - b;
  const k = shine();
  g.fillStyle = alpha(r[5], .55 * k); g.beginPath(); g.moveTo(3, 3); g.lineTo(uw - 3, 3); g.lineTo(x1, y0); g.lineTo(x0, y0); g.closePath(); g.fill();
  g.fillStyle = alpha(r[4], .7 * k); g.beginPath(); g.moveTo(3, 3); g.lineTo(x0, y0); g.lineTo(x0, y1); g.lineTo(3, uh - 3); g.closePath(); g.fill();
  g.fillStyle = alpha(r[1], .85); g.beginPath(); g.moveTo(uw - 3, uh - 3); g.lineTo(3, uh - 3); g.lineTo(x0, y1); g.lineTo(x1, y1); g.closePath(); g.fill();
  g.fillStyle = alpha(r[2], .9); g.beginPath(); g.moveTo(uw - 3, 3); g.lineTo(uw - 3, uh - 3); g.lineTo(x1, y1); g.lineTo(x1, y0); g.closePath(); g.fill();
  const tg = g.createLinearGradient(x0, y0, x1, y1); tg.addColorStop(0, finish === 'shiny' ? r[4] : r[3]); tg.addColorStop(.5, r[3]); tg.addColorStop(1, finish === 'matte' ? r[3] : r[2]);
  g.fillStyle = tg; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = alpha(r[0], .5); g.lineWidth = .8; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  g.save(); emblemTransform(g, uw, uh, .74); engrave(g, EMBLEMS[color], r); g.restore();
  if (finish === 'shiny') { glint(g, x0 + 3, y0 + 3, 1.3); glint(g, x1 - 4, y1 - 5, .7); }
}
function drawSword(g, uw, uh) {             // incoming strike, tip down
  const cx = uw / 2, pomH = Math.max(3, uh * .055), gripTop = pomH, guardY = Math.max(pomH + 8, uh * .2), gh = Math.max(3, uh * .045);
  const bw = Math.max(5, uw * .8), tipY = uh - Math.max(5, Math.min(uw * .6, uh * .26)), bx0 = cx - bw / 2, bx1 = cx + bw / 2;
  g.lineJoin = 'round';
  const blade = new Path2D(); blade.moveTo(bx0, guardY); blade.lineTo(bx1, guardY); blade.lineTo(bx1, tipY); blade.lineTo(cx, uh - .8); blade.lineTo(bx0, tipY); blade.closePath();
  g.fillStyle = '#23262e'; g.save(); g.translate(0, 0); g.lineWidth = 2; g.strokeStyle = '#1b1d24'; g.stroke(blade); g.restore();
  const bg = g.createLinearGradient(bx0, 0, bx1, 0); bg.addColorStop(0, '#f4f6f8'); bg.addColorStop(.48, '#cfd5dd'); bg.addColorStop(.52, '#8a93a1'); bg.addColorStop(1, '#5d6573');
  g.fillStyle = bg; g.fill(blade);
  g.save(); g.clip(blade);
  g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(.8, uw * .03); g.beginPath(); g.moveTo(cx - .4, guardY + 2); g.lineTo(cx - .4, uh - 3); g.stroke();
  if (bw >= 10) { g.strokeStyle = 'rgba(70,78,92,.55)'; g.lineWidth = Math.max(.8, bw * .07); g.beginPath(); g.moveTo(cx + bw * .14, guardY + 3); g.lineTo(cx + bw * .14, tipY - 2); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx0, guardY, bw * .18, uh);
  g.restore();
  // crossguard with curled quillons and a ruby
  const gp = new Path2D(); gp.roundRect(1, guardY - gh, uw - 2, gh, gh / 2);
  gp.moveTo(1.2, guardY - gh * .2); gp.quadraticCurveTo(-.2, guardY + gh * 1.3, 2.8, guardY + gh * 1.4); gp.lineTo(3, guardY + gh * .6); gp.closePath();
  gp.moveTo(uw - 1.2, guardY - gh * .2); gp.quadraticCurveTo(uw + .2, guardY + gh * 1.3, uw - 2.8, guardY + gh * 1.4); gp.lineTo(uw - 3, guardY + gh * .6); gp.closePath();
  g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke(gp);
  const gg = g.createLinearGradient(0, guardY - gh, 0, guardY); gg.addColorStop(0, GOLD[4]); gg.addColorStop(.4, GOLD[3]); gg.addColorStop(1, GOLD[1]);
  g.fillStyle = gg; g.fill(gp);
  const rw = Math.max(2.4, uw * .13); g.fillStyle = INK; g.beginPath(); g.ellipse(cx, guardY - gh / 2, rw / 2 + .7, gh / 2 + .5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#a32a2a'; g.beginPath(); g.ellipse(cx, guardY - gh / 2, rw / 2, gh / 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffb19c'; g.fillRect(cx - rw * .25, guardY - gh * .8, Math.max(.8, rw * .22), Math.max(.8, gh * .22));
  // wrapped grip
  const gw = Math.max(3, uw * .24), gx = cx - gw / 2, gy0 = gripTop + .5, gy1 = guardY - gh;
  g.fillStyle = INK; g.fillRect(gx - .7, gy0, gw + 1.4, gy1 - gy0);
  g.fillStyle = '#5a3a22'; g.fillRect(gx, gy0, gw, gy1 - gy0);
  g.strokeStyle = '#2b1a0e'; g.lineWidth = Math.max(.7, uh * .012);
  for (let y = gy0 + 1.5; y < gy1; y += Math.max(2.2, uh * .035)) { g.beginPath(); g.moveTo(gx, y + 1); g.lineTo(gx + gw, y - .6); g.stroke(); }
  g.fillStyle = 'rgba(255,220,180,.25)'; g.fillRect(gx, gy0, Math.max(.8, gw * .25), gy1 - gy0);
  // pommel
  const pr = Math.max(2, gw * .75); g.fillStyle = INK; g.beginPath(); g.ellipse(cx, pomH * .6, pr + .7, pomH * .6 + .6, 0, 0, Math.PI * 2); g.fill();
  const pg = g.createLinearGradient(0, 0, 0, pomH * 1.2); pg.addColorStop(0, GOLD[4]); pg.addColorStop(1, GOLD[1]);
  g.fillStyle = pg; g.beginPath(); g.ellipse(cx, pomH * .6, pr, pomH * .6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#a32a2a'; g.beginPath(); g.arc(cx, pomH * .6, Math.max(.8, pr * .35), 0, Math.PI * 2); g.fill();
}
function drawTray(g, uw, uh, cellW, cellH, style) {
  const bg = g.createLinearGradient(0, 0, 0, uh);
  if (style === 'obsidian') { bg.addColorStop(0, '#0f0c14'); bg.addColorStop(1, '#08070b'); } else { bg.addColorStop(0, '#1b1c23'); bg.addColorStop(1, '#121318'); }
  g.fillStyle = bg; g.fillRect(0, 0, uw, uh);
  for (let x = 0, i = 0; x < uw - 1; x += cellW, i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.018)' : 'rgba(0,0,0,.08)'; g.fillRect(x, 0, cellW, uh); }
  g.fillStyle = style === 'obsidian' ? 'rgba(212,162,76,.12)' : 'rgba(184,153,105,.09)';
  for (let x = cellW; x < uw - 1; x += cellW) g.fillRect(Math.round(x) - .5, 0, 1, uh);
  g.fillStyle = 'rgba(184,153,105,.06)';
  for (let y = cellH; y < uh - 1; y += cellH) for (let x = 0; x < uw; x += 4) g.fillRect(x, Math.round(y), 1.5, 1);
  if (style === 'obsidian') { const rnd = seeded(9); for (let i = 0; i < uw * uh / 900; i++) { g.fillStyle = 'rgba(212,162,76,.5)'; g.fillRect(rnd() * uw, rnd() * uh, 1, 1); } }
  const sh = g.createLinearGradient(0, 0, 0, 14); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, 0, uw, 14);
}

// ---------- sprite cache, keyed by on-screen pixel size ----------
const cache = new Map();
// Pixel finish: the vector design is drawn at "art" resolution (about 26 art pixels across a cell,
// twice the original pixel skin), snapped to the piece's palette with hard edges, then scaled up
// by a whole number so every art pixel is a crisp square. Clean engravings, pixel-art character.
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function snap(g, w, h, palette) {
  const img = g.getImageData(0, 0, w, h), d = img.data, P = palette.map(hex);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) { d[i + 3] = 0; continue; } d[i + 3] = 255;
    let best = 0, bd = 1e9; for (let k = 0; k < P.length; k++) { const p = P[k], e = (d[i] - p[0]) ** 2 * .3 + (d[i + 1] - p[1]) ** 2 * .59 + (d[i + 2] - p[2]) ** 2 * .11; if (e < bd) { bd = e; best = k; } }
    d[i] = P[best][0]; d[i + 1] = P[best][1]; d[i + 2] = P[best][2];
  }
  g.putImageData(img, 0, 0);
}
function sprite(key, pw, ph, uw, uh, draw, palette) {
  const k = key + '@' + pw + 'x' + ph; let s = cache.get(k); if (s) return s;
  if (cache.size > 600) cache.clear();
  if (!palette) { const [c, g] = mk(pw, ph); g.scale(pw / uw, ph / uh); draw(g); cache.set(k, c); return c; }
  const cellPx = pw * 32 / uw, scale = Math.max(1, Math.round(cellPx / 26)), aw = Math.max(4, Math.round(pw / scale)), ah = Math.max(4, Math.round(ph / scale));
  const [a, ga] = mk(aw, ah); ga.scale(aw / uw, ah / uh); draw(ga); snap(ga, aw, ah, palette);
  const [c, g] = mk(aw * scale, ah * scale); g.imageSmoothingEnabled = false; g.drawImage(a, 0, 0, aw * scale, ah * scale);
  cache.set(k, c); return c;
}
const LIGHT = ['#ffffff', '#fff3d6', INK];
const palOf = (color, kind) => kind === 's' || kind === 'd' ? [...STONE, ...RAMP[color], ...LIGHT] : [...RAMP[color], ...LIGHT];
const SWORD_PAL = ['#ffffff', '#f4f6f8', '#cfd5dd', '#a9b1bc', '#8a93a1', '#5d6573', '#3a3f4a', '#1b1d24', ...GOLD, '#5a3a22', '#2b1a0e', '#8a5a3a', '#a32a2a', '#ffb19c', INK];
const scaleOf = ctx => { const m = ctx.getTransform(); return [Math.hypot(m.a, m.b) || 1, Math.hypot(m.c, m.d) || 1]; };

// ---------- effects ----------
let reduced = false;
const readReduced = () => { try { const p = JSON.parse(localStorage.getItem('scraps.preferences') || '{}'); reduced = !!p.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches; nightGlow = p.night && p.night !== 'off' ? .55 : 1; const st = 'bold', fin = FINISHES.includes(p.pieceFinish) ? p.pieceFinish : 'shiny'; if (fin !== finish) { finish = fin; if (typeof document !== 'undefined' && document.getElementById('scraps-tiles')) { document.getElementById('scraps-tiles').remove(); publishTiles(); } } if (st !== breakerStyle) { breakerStyle = st; if (typeof document !== 'undefined' && document.getElementById('scraps-tiles')) { document.getElementById('scraps-tiles').remove(); publishTiles(); } } } catch {} };
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
function glow(ctx, x, y, r, col, a) { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
const RGB = RAMP.map(r => { const h = r[4]; return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(','); });

const skin = {
  ready: false,
  tile(ctx, x, y, c, w, h, a) {
    if (c.color == null || !RAMP[c.color]) return false;
    const [sx, sy] = scaleOf(ctx), pw = Math.max(4, Math.round(w * sx)), ph = Math.max(6, Math.round(h * sy));
    const kind = c.breaker && !c.stage ? 'k' : c.stage > 1 ? 's' : c.stage === 1 ? 'd' : 'b';
    const s = sprite((kind === 'k' ? 'k' + breakerStyle + c.color : kind + c.color) + finish, pw, ph, 32, 48, g => kind === 'k' ? drawBreakerStyle(g, c.color, 32, 48, breakerStyle) : drawBlock(g, c.color, kind === 's' ? 'stone' : kind === 'd' ? 'decay' : 'block', 32, 48), kind === 'k' ? palOf(c.color, 'k') : palOf(c.color, kind));
    ctx.save(); ctx.globalAlpha = a;
    if (kind === 'k' && !reduced && a > .5) breakerGlow(ctx, x, y, w, h, c.color, breakerStyle, now());
    ctx.imageSmoothingEnabled = false; ctx.drawImage(s, x, y, w, h); ctx.restore();
    if (a > .5) stages.tile(ctx, x, y, w, h, c.color, kind);
    return true;
  },
  gem(ctx, x, y, w, h, gm) {
    fusion.see(ctx.canvas, gm);
    const [sx, sy] = scaleOf(ctx), pw = Math.round(w * sx), ph = Math.round(h * sy), uw = gm.w * 32, uh = gm.h * 48;
    const s = sprite('g' + gm.color + '-' + gm.w + 'x' + gm.h + finish, pw, ph, uw, uh, g => drawGem(g, gm.color, uw, uh), palOf(gm.color, 'g'));
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(s, x, y, w, h);
    if (!reduced && finish === 'shiny') {
      const t = (now() * .35 + (gm.x * 7 + gm.y * 3) * .13) % 2.6; if (t < 1) {
        ctx.beginPath(); ctx.rect(x + 5, y + 5, w - 10, h - 10); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
        const lx = x - h + (w + h * 2) * t; ctx.fillStyle = 'rgba(255,255,255,.14)';
        ctx.beginPath(); ctx.moveTo(lx, y + h); ctx.lineTo(lx + 10, y + h); ctx.lineTo(lx + 10 + h * .6, y); ctx.lineTo(lx + h * .6, y); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore(); return true;
  },
  sword(ctx, wide, len) {
    // the pixel great sword (forge-art.js), at half the board's units so its pixels match the blade icons
    const s = strikeSprite(wide / 2, len / 2);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(s, -wide / 2, -len / 2, wide, len); return true;
  },
  board(ctx, w, h) {
    fusion.frame(ctx.canvas); stages.frame(ctx.canvas);
    const style = globalThis.scrapsCosmetics?.tray === 'obsidian-tray' ? 'obsidian' : 'slate';
    const [sx, sy] = scaleOf(ctx), pw = Math.round(w * sx), ph = Math.round(h * sy);
    ctx.drawImage(sprite('tray-' + style + w + 'x' + h, pw, ph, w, h, g => drawTray(g, w, h, 32, 48, style)), 0, 0, w, h); return true;
  },
  clear(ctx, cx, cy, color, age, life) {            // a bright pop, then the piece bursts into four chunks and sparks
    if (reduced) return false;
    const r = RAMP[color]; if (!r) return false;
    if (age >= 70) burst(ctx, cx, cy, color);
    if (age < 120) {                                     // the pop: the cell flares white and a ring opens
      const t = age / 120; ctx.save();
      ctx.globalAlpha = (1 - t) * .85; ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.roundRect(cx - 15, cy - 23, 30, 46, 5); ctx.fill();
      ctx.globalAlpha = (1 - t) * .8; ctx.strokeStyle = r[5]; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, 8 + t * 10, 12 + t * 14, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    return true;
  },
};

// square tile images for pattern previews, editors and swatches: --tile-0..3, --tile-stone-0..3, --tile-breaker-0..3
function publishTiles() {
  const css = [];
  for (let c = 0; c < 4; c++) {
    const t = (kind, draw) => sprite('tile-' + kind + c + finish, 78, 117, 32, 48, draw, palOf(c, kind)).toDataURL();
    css.push(`--tile-${c}:url(${t('b', g => drawBlock(g, c, 'block', 32, 48))})`);
    css.push(`--tile-stone-${c}:url(${t('s', g => drawBlock(g, c, 'stone', 32, 48))})`);
    css.push(`--tile-breaker-${c}:url(${sprite('tile-k' + breakerStyle + c + finish, 78, 117, 32, 48, g => drawBreakerStyle(g, c, 32, 48, breakerStyle), palOf(c, 'k')).toDataURL()})`);
  }
  const st = document.createElement('style'); st.id = 'scraps-tiles'; st.textContent = `:root{${css.join(';')}}`; document.head.append(st);
}
// one-off renders for menus and exports
globalThis.scrapsSkinRefresh = () => readReduced();
skin.render = {setFinish: f => { finish = FINISHES.includes(f) ? f : 'shiny'; }, finishes: FINISHES, block: drawBlock, breaker: drawBreaker, breakerStyle: drawBreakerStyle, breakerGlow, styles: BREAKER_STYLES, gem: drawGem, sword: drawSword, emblems: EMBLEMS, ramp: RAMP};

if (hasDom) { try { mk(1, 1)[1].roundRect || (CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); }); publishTiles(); readReduced(); setInterval(readReduced, 2000); skin.ready = true; } catch (e) { console.warn('skin disabled', e); } }
// Gem fusion sound: a new gem id on the player's own board means blocks just fused (or a gem
// grew into a bigger one). Watched from the drawn frames so the engine stays untouched.
const MINE = /^(board-0|challenge-board-0|rogue-board|paired-board-0|play-board)$/;
const sfxPrefs = () => { try { return JSON.parse(localStorage.getItem('scraps.preferences') || '{}'); } catch { return {}; } };
const fusion = (() => {
  const seen = new WeakMap(), cur = new WeakMap();
  return {
    see(cv, gm) { if (MINE.test(cv?.id || '')) { let m = cur.get(cv); if (!m) cur.set(cv, m = new Map()); m.set(gm.id, gm.w * gm.h); } },
    frame(cv) {
      if (!MINE.test(cv?.id || '')) return;
      const now = cur.get(cv) || new Map(), before = seen.get(cv); seen.set(cv, now); cur.set(cv, new Map());
      if (!before) return;
      let fresh = 0, size = 0; for (const [id, n] of now) if (!before.has(id)) { fresh++; size = Math.max(size, n); }
      if (!fresh || fresh > 3) return;                                   // more than three at once is a replay seek or a reload
      globalThis.scrapsSfx?.('fuse', size, sfxPrefs());
    },
  };
})();
// Stage changes on garbage, drawn as they happen: grey stone cracks open to show its colour (2 -> 1),
// then the shell falls away and the block is free (1 -> 0). Tracked per board from the drawn frames.
const stages = (() => {
  const boards = new WeakMap(), LIFE = .42;
  const of = cv => { let m = boards.get(cv); if (!m) boards.set(cv, m = {prev: new Map(), cur: new Map(), fx: new Map(), cracked: 0, freed: 0}); return m; };
  return {
    frame(cv) {
      const m = of(cv); m.prev = m.cur; m.cur = new Map();
      if ((m.cracked || m.freed) && MINE.test(cv?.id || '') && m.cracked + m.freed < 40) {
        const p = sfxPrefs(); if (m.cracked) globalThis.scrapsSfx?.('crack', m.cracked, p); if (m.freed) globalThis.scrapsSfx?.('free', m.freed, p, .05);
      }
      m.cracked = m.freed = 0;
    },
    tile(ctx, x, y, w, h, color, kind) {
      const m = of(ctx.canvas), key = Math.round(x) + ',' + Math.round(y), was = m.prev.get(key), t = now();
      m.cur.set(key, kind + color);
      if (was === 's' + color && kind === 'd') { m.fx.set(key, {type: 'crack', t0: t}); m.cracked++; }
      else if (was === 'd' + color && kind === 'b') { m.fx.set(key, {type: 'free', t0: t}); m.freed++; }
      const fx = m.fx.get(key); if (!fx) return;
      const age = (t - fx.t0) / LIFE; if (age >= 1 || reduced) { m.fx.delete(key); return; }
      const r = RAMP[color], cx = x + w / 2, cy = y + h / 2; let s = (key.length * 977 + Math.round(x) * 31 + Math.round(y) * 17) | 0; const rnd = () => ((s = (s * 16807 + 7) % 2147483647) / 2147483647);
      ctx.save();
      if (fx.type === 'crack') {            // a bright split runs through the stone, a few chips spit out
        ctx.globalAlpha = (1 - age) * .9; ctx.globalCompositeOperation = 'lighter'; glow(ctx, cx, cy, w * .7, RGB[color], .45); ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1 - age; ctx.fillStyle = r[5]; ctx.beginPath(); ctx.moveTo(cx - 2, y + 2); ctx.lineTo(cx + 3, y + h * .35); ctx.lineTo(cx - 2, y + h * .6); ctx.lineTo(cx + 2, y + h - 2); ctx.lineTo(cx - 1, y + h - 2); ctx.lineTo(cx - 5, y + h * .6); ctx.lineTo(cx, y + h * .35); ctx.lineTo(cx - 5, y + 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = STONE[3];
        for (let i = 0; i < 5; i++) { const a = rnd() * Math.PI * 2, v = 10 + rnd() * 16, sz = 4 + rnd() * 3; ctx.fillRect(cx + Math.cos(a) * v * age - sz / 2, cy + Math.sin(a) * v * age + 40 * age * age - sz / 2, sz, sz); }
      } else {                               // the shell drops away in pieces and the colour flashes free
        ctx.globalAlpha = (1 - age) * .8; ctx.globalCompositeOperation = 'lighter'; glow(ctx, cx, cy, w * 1.1, RGB[color], .6); ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1 - age * age;
        for (let i = 0; i < 7; i++) { const sx = x + 2 + rnd() * (w - 10), sy = y + 2 + rnd() * (h - 10), dx = (sx - cx) * 1.2, sz = 6 + rnd() * 5;
          ctx.fillStyle = i % 2 ? STONE[2] : STONE[3]; ctx.fillRect(sx + dx * age, sy + 60 * age * age, sz, sz * .75); ctx.fillStyle = STONE[0]; ctx.fillRect(sx + dx * age, sy + 60 * age * age + sz * .6, sz, 1.5); }
      }
      ctx.restore();
    },
  };
})();
// Incoming attacks on the player's own board are voiced as they are drawn: the swords' impact when
// they land, then a patter as each sprinkle settles on top (same timing as render.js draws them).
const attacks = new WeakMap();
// Warning: a new attack queued against the player's own board sounds a warning, longer for bigger attacks.
const warned = new WeakMap();
skin.incoming = (cv, list) => {
  if (!MINE.test(cv?.id || '')) return;
  const ids = new Set((list || []).map(b => b.id)), seen = warned.get(cv); warned.set(cv, ids);
  if (!seen) return;                                   // first frame on this board: nothing is new yet
  // YPP: small (area 6 or less), big (under 10), huge; an attack of only sprinkles warns only with 4 or more
  let area = 0, pebbles = 0, strikes = 0, fresh = false;
  for (const b of list || []) { if (seen.has(b.id)) continue; fresh = true; for (const a of b.attacks ?? [b]) { if (a.kind === 'sprinkle') pebbles += a.count | 0; else { strikes++; area = Math.max(area, (a.width | 0) * (a.length | 0)); } } }
  if (!fresh || (!strikes && pebbles < 4)) return;
  globalThis.scrapsSfx?.('warn', !strikes ? 1 : area <= 6 ? 1 : area < 10 ? 2 : 4, sfxPrefs());
};
skin.attack = (cv, incoming, timer) => {
  if (!MINE.test(cv?.id || '') || !incoming) return;
  const id = incoming.batchId ?? incoming; if (attacks.get(cv) === id) return; attacks.set(cv, id);
  const dur = (incoming.duration || 320) / 1000, p0 = Math.max(0, Math.min(1, 1 - timer / (incoming.duration || 320))), hits = incoming.hits ?? [incoming.hit];
  const swords = hits.filter(a => a.kind !== 'sprinkle' && a.placement).length, placed = hits.filter(a => a.kind === 'sprinkle').flatMap(a => a.placed || []), prefs = sfxPrefs();
  const at = p => Math.max(0, (p - p0) * dur);
  // YPP timing: each strike has its own slot; sounds land with it, sprinkle stacks patter after all the strikes
  if (incoming.schedule) {
    const ms = (incoming.duration || 1) * p0, sec = t => Math.max(0, (t - ms) / 1000), before = incoming.before;
    for (const s of incoming.schedule) { const a = hits[s.i], q = a?.placement; if (!q) continue;
      const side = a.kind === 'horizontal' && !a.converted;
      if (side && q.hand) globalThis.scrapsSfx?.('slide', q.hand, prefs, sec(s.start));
      let crushed = 0; if (before) for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) if (before[y]?.[x]) crushed++;
      const onto = side ? 'wall' : q.y === 0 ? 'floor' : 'pieces', area = (a.width || q.w) * (a.length || q.h);
      globalThis.scrapsSfx?.('impact', {area, crushed, onto, hand: q.hand}, prefs, sec(s.end)); }
    // each column's sprinkles land as one stack: louder for a taller stack and a bigger attack
    const cols = new Map(); for (const c of placed) { const k = cols.get(c.x) || {low: 13, n: 0}; k.low = Math.min(k.low, c.y); k.n++; cols.set(c.x, k); }
    for (const k of cols.values()) globalThis.scrapsSfx?.('pebbles', {n: k.n, total: placed.length, cols: cols.size, onto: k.low === 0 ? 'floor' : 'pieces'}, prefs, sec(incoming.sprinkleStart + (13 - k.low) * incoming.rowMs));
    return;
  }
  if (swords) globalThis.scrapsSfx?.('strike', swords, prefs, at(.55));
  // side swords scrape in from their edge before they bite
  for (const a of hits) if (a.kind === 'horizontal' && a.placement?.hand && !a.converted) globalThis.scrapsSfx?.('slide', a.placement.hand, prefs, at(0));
  // pieces a sword lands on are crushed: a crunch when it bites
  const before = incoming.before; let crushed = 0;
  if (before) for (const a of hits) { const q = a.placement; if (a.kind === 'sprinkle' || !q) continue; for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) if (before[y]?.[x]) crushed++; }
  if (crushed) globalThis.scrapsSfx?.('crush', crushed, prefs, at(.57));
  const n = placed.length, voices = Math.min(n, 6);
  for (let i = 0; i < voices; i++) { const lag = voices > 1 ? i / (voices - 1) * .3 : 0, land = Math.min(1, lag + (n > 1 ? .7 : 1)); globalThis.scrapsSfx?.('patter', n, prefs, at(swords ? .5 + .5 * land : land)); }
};
// Full clear: the player's own board emptied by a break. It counts when the board held at least ten
// blocks just before the break, or the game has run for ten seconds or more (never a freebie at the
// very start). A small pop-up over the board, a chime, and gold sparkles rising off the empty tray.
const clears = new WeakMap(), FC_LIFE = 1.6;
const filled = b => { let n = 0; for (const row of b || []) for (const c of row) if (c) n++; return n; };
function fullClearPop(cv) {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const el = document.createElement('div'); el.className = 'fullclear-pop'; el.setAttribute('role', 'status'); el.textContent = 'Full clear!';
  el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.top + r.height * .32) + 'px';
  document.body.append(el); setTimeout(() => el.remove(), 1900);
}
// Break bursts: each broken piece splits into four small chunks (2x2) tossed up and out, falling back under
// gravity and fading, with a couple of sparks. Speeds in board units
// per ms (a row is 48 units): chunks up to 0.06 sideways (outward from the half they came from) and 0.32 up,
// gravity 0.000626, fading over 420 ms; two sparks each. They outlive the break, so they finish in the air.
const bursts = new WeakMap();
function burst(ctx, cx, cy, color) {
  const cv = ctx.canvas; let b = bursts.get(cv); if (!b) bursts.set(cv, b = {list: [], seen: new Map()});
  const t0 = now() * 1000, key = Math.round(cx) + ',' + Math.round(cy), last = b.seen.get(key);
  if (last && t0 - last < 700) return; b.seen.set(key, t0);
  if (b.list.length > 400) b.list.splice(0, b.list.length - 400);
  for (let q = 0; q < 4; q++) {
    const sx = q % 2, sy = q >> 1, dir = sx ? 1 : -1;
    b.list.push({kind: 'chunk', color, t0, x: cx - 6 + sx * 12, y: cy - 9 + sy * 18, vx: dir * (.02 + Math.random() * .04), vy: -(.12 + Math.random() * .2), sx, sy});
  }
  for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2, v = .12 + Math.random() * .14; b.list.push({kind: 'spark', color, t0, x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v}); }
}
function drawBursts(ctx, cv) {
  const b = bursts.get(cv); if (!b || !b.list.length) return;
  const t = now() * 1000, [sx, sy] = scaleOf(ctx), G = .000626;
  b.list = b.list.filter(q => t - q.t0 < (q.kind === 'chunk' ? 420 : 450));
  ctx.save();
  for (const q of b.list) {
    const age = t - q.t0, x = q.x + q.vx * age, y = q.y + q.vy * age + (q.kind === 'chunk' ? .5 * G * age * age : 0);
    if (q.kind === 'chunk') {
      ctx.globalAlpha = 1 - .9 * age / 420;
      const img = sprite('b' + q.color + finish, Math.max(4, Math.round(32 * sx)), Math.max(6, Math.round(48 * sy)), 32, 48, g => drawBlock(g, q.color, 'block', 32, 48), palOf(q.color, 'b'));
      ctx.imageSmoothingEnabled = false; ctx.drawImage(img, q.sx * img.width / 2, q.sy * img.height / 2, img.width / 2, img.height / 2, x - 6, y - 9, 12, 18);
    } else {
      ctx.globalAlpha = 1 - .9 * age / 450; ctx.fillStyle = RAMP[q.color][5]; ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - .7, y - .7, 1.4, 1.4);
    }
  }
  ctx.restore();
}
skin.crush = (ctx, cx, cy, color) => burst(ctx, cx, cy, color ?? 0);
skin.after = (ctx, cv, p, w, h) => {
  if (!reduced) drawBursts(ctx, cv);
  if (!MINE.test(cv?.id || '') || !p) return;
  let m = clears.get(cv); const t = now();
  if (!m || (p.stats?.pieces ?? 0) < (m.pieces ?? 0)) { m = {start: t, pieces: 0, before: 0, armed: false, fx: -1}; clears.set(cv, m); }   // a new game on this board
  m.pieces = p.stats?.pieces ?? 0;
  const board = p.phase === 'attack' ? p.attackVisual?.before : p.board, n = filled(board);
  if (p.phase === 'clear') { if (!m.armed) { m.armed = true; m.before = Math.max(m.before, m.lastFull || 0); } }
  else {
    if (m.armed && n === 0 && (p.phase === 'settle' || p.phase === 'entry' || p.phase === 'fall' || p.phase === 'attack')) {
      if (m.before >= 10 || t - m.start >= 10) { m.fx = t; fullClearPop(cv); globalThis.scrapsTally?.('fullclear'); globalThis.scrapsSfx?.('fullclear', 1, sfxPrefs()); }
      m.armed = false; m.before = 0;
    } else if (m.armed && n > 0 && p.phase !== 'settle') { m.armed = false; m.before = 0; }
    if (!m.armed) m.lastFull = n;
  }
  // sparkles over the empty tray for a moment after it happens
  const age = (t - m.fx) / FC_LIFE; if (m.fx < 0 || age >= 1 || reduced) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const yc = h * (1 - age * 1.1); ctx.globalAlpha = (1 - age) * .55; const gr = ctx.createLinearGradient(0, yc - 70, 0, yc + 70); gr.addColorStop(0, 'rgba(255,215,120,0)'); gr.addColorStop(.5, 'rgba(255,215,120,.3)'); gr.addColorStop(1, 'rgba(255,215,120,0)'); ctx.fillStyle = gr; ctx.fillRect(0, yc - 70, w, 140);
  let s = 4242; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) { const x = rnd() * w, y0 = h * (.4 + rnd() * .6), y = y0 - age * (120 + rnd() * 200), tw = .5 + .5 * Math.sin(t * 14 + i), k = 2 + rnd() * 3;
    ctx.globalAlpha = (1 - age) * tw; ctx.fillStyle = i % 3 ? '#ffe9a8' : '#ffffff'; ctx.fillRect(x - k / 2, y - .5, k, 1.5); ctx.fillRect(x - .75, y - k / 2, 1.5, k); }
  ctx.restore();
};
globalThis.scrapsSkin = skin;
export default skin;
