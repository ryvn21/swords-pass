// Procedural pixel art for future content: themed blades (new sword patterns) and Adventure
// reward / encounter icons. Shapes are drawn as vectors at art resolution, then snapped to hard
// pixels with a 1px ink outline, so they sit with the tavern's high-fidelity pixel style.
// Used by art/tools/forge-art.html to export PNGs; safe to import in the game for live use.

const INK = '#140c0c';
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

// vector -> pixel art: hard alpha, then a 1px outline around the shape
export function pixelize(w, h, draw, {outline = INK, pad = 1} = {}) {
  const [a, ga] = mk(w, h); draw(ga, w, h);
  const img = ga.getImageData(0, 0, w, h), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 100 ? 255 : 0;
  ga.putImageData(img, 0, 0);
  const [c, g] = mk(w + pad * 2, h + pad * 2); g.drawImage(a, pad, pad);
  if (outline) {
    const src = g.getImageData(0, 0, w + pad * 2, h + pad * 2), s = src.data, W = w + pad * 2, H = h + pad * 2, out = g.createImageData(W, H), o = out.data;
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && s[(y * W + x) * 4 + 3] > 0;
    const [r, gg, b] = [1, 3, 5].map(i => parseInt(outline.slice(i, i + 2), 16));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4;
      if (on(x, y)) { o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; o[i + 3] = 255; }
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { o[i] = r; o[i + 1] = gg; o[i + 2] = b; o[i + 3] = 255; } }
    g.putImageData(out, 0, 0);
  }
  return c;
}
export function scaled(src, k) { const [c, g] = mk(src.width * k, src.height * k); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, c.width, c.height); return c; }

// ---------- themed blades ----------
// palettes: blade [shadow, mid, light, edge], metal for guard/pommel [shadow, mid, light], grip [dark, light], gem, glow
export const BLADES = [
  {id: 'emberbrand', name: 'Emberbrand', theme: 'Fire', blade: ['#5a1a0e', '#b8401c', '#f08a3a', '#ffe0a0'], metal: ['#4a2a10', '#9a6a2a', '#e8b860'], grip: ['#2a1410', '#6a2a1a'], gem: '#ff5a2a', glow: '#ffb040', shape: 'flame', guard: 'flame', pommel: 'flame', decor: 'cracks'},
  {id: 'frostfang', name: 'Frostfang', theme: 'Ice', blade: ['#3a5a7a', '#8ab8e0', '#d8f0ff', '#ffffff'], metal: ['#2a3a5a', '#6a8ab0', '#c0dcf4'], grip: ['#1a2a40', '#3a5a80'], gem: '#7ad8ff', glow: '#bff0ff', shape: 'crystal', guard: 'icicle', pommel: 'shard', decor: 'frost'},
  {id: 'thornroot', name: 'Thornroot', theme: 'Verdant', blade: ['#2a4a2a', '#5a8a4a', '#a8d090', '#e8ffd8'], metal: ['#3a2a14', '#6a4a24', '#a07a44'], grip: ['#1e2a14', '#4a6a2a'], gem: '#7ae05a', glow: '#b8ff8a', shape: 'leaf', guard: 'antlers', pommel: 'orb', decor: 'vines'},
  {id: 'stormcaller', name: 'Stormcaller', theme: 'Storm', blade: ['#2a3450', '#6070a0', '#b8c4e8', '#ffffff'], metal: ['#2a2a40', '#5a5a80', '#a0a0d0'], grip: ['#14142a', '#34345a'], gem: '#8ab8ff', glow: '#e0f0ff', shape: 'straight', guard: 'wings', pommel: 'orb', decor: 'lightning'},
  {id: 'bloodmoon', name: 'Bloodmoon', theme: 'Blood', blade: ['#3a0a12', '#8a1a24', '#d8443a', '#ffb0a0'], metal: ['#2a1a1a', '#6a4040', '#b08080'], grip: ['#1a0a0a', '#4a1414'], gem: '#ff2a3a', glow: '#ff6a6a', shape: 'curved', guard: 'crescent', pommel: 'crescent', decor: 'drips'},
  {id: 'gilded-oath', name: 'Gilded Oath', theme: 'Gilt', blade: ['#5a5a64', '#a8acb8', '#e8ecf4', '#ffffff'], metal: ['#6a4210', '#c8963f', '#ffe9a0'], grip: ['#3a0a0a', '#8a1a1a'], gem: '#d42a3a', glow: '#ffe9a0', shape: 'broad', guard: 'cross', pommel: 'gem', decor: 'filigree'},
  {id: 'voidglass', name: 'Voidglass', theme: 'Arcane', blade: ['#120a1e', '#2e1a4a', '#6a3aa8', '#d0a8ff'], metal: ['#1a1024', '#3a2a50', '#7a6aa0'], grip: ['#0a0612', '#241a3a'], gem: '#b06aff', glow: '#d8b0ff', shape: 'straight', guard: 'wings', pommel: 'shard', decor: 'stars'},
  {id: 'bonereaver', name: 'Bonereaver', theme: 'Bone', blade: ['#6a6050', '#b8ac94', '#ece2cc', '#fffaf0'], metal: ['#4a4032', '#8a7a62', '#cfc0a0'], grip: ['#2a1e14', '#5a4430'], gem: '#3a2a20', glow: '#fff0d0', shape: 'serrated', guard: 'skull', pommel: 'orb', decor: 'none'},
  {id: 'tidecutter', name: 'Tidecutter', theme: 'Sea', blade: ['#0e3a44', '#2a8a94', '#7ad8d0', '#e0fff8'], metal: ['#2a3a3a', '#5a8a80', '#a8d8c8'], grip: ['#0a2024', '#1e4a50'], gem: '#3ae0d0', glow: '#b0fff0', shape: 'wave', guard: 'shell', pommel: 'orb', decor: 'bubbles'},
  {id: 'duskwhisper', name: 'Duskwhisper', theme: 'Shadow', blade: ['#1a1a24', '#3a3a50', '#7a7a98', '#c8c8e0'], metal: ['#1a1418', '#3a3038', '#6a5a68'], grip: ['#0a0a10', '#22222e'], gem: '#5a6aff', glow: '#a0a8ff', shape: 'needle', guard: 'bar', pommel: 'ring', decor: 'smoke'},
  {id: 'sunspire', name: 'Sunspire', theme: 'Radiant', blade: ['#8a6a2a', '#e8c060', '#fff0b0', '#ffffff'], metal: ['#6a4210', '#d8a040', '#fff0b0'], grip: ['#4a2a0a', '#a0601a'], gem: '#ffd84a', glow: '#fff4c0', shape: 'broad', guard: 'sun', pommel: 'sun', decor: 'rays'},
  {id: 'hearthkeeper', name: "Hearthkeeper's Cleaver", theme: 'Tavern', blade: ['#3a3a3e', '#7a7a80', '#c0c0c6', '#eaeaee'], metal: ['#5a3a1a', '#a06a30', '#e0a860'], grip: ['#3a2410', '#7a5030'], gem: '#c84a1a', glow: '#ffb070', shape: 'cleaver', guard: 'bar', pommel: 'ring', decor: 'none'},
];

function bladePath(def, cx, top, bot, bw) {
  const p = new Path2D(), L = bot - top, s = def.shape, hw = bw / 2, tip = Math.min(16, L * .2);
  if (s === 'curved') { p.moveTo(cx - hw, top); p.lineTo(cx + hw, top); p.quadraticCurveTo(cx + hw + L * .07, top + L * .6, cx + L * .09, bot); p.quadraticCurveTo(cx - hw + 2, top + L * .55, cx - hw, top); }
  else if (s === 'katana') { p.moveTo(cx - hw, top); p.lineTo(cx + hw, top); p.quadraticCurveTo(cx + hw + L * .05, top + L * .7, cx + L * .06, bot - 4); p.lineTo(cx + L * .06 - 2, bot); p.quadraticCurveTo(cx - hw + L * .02, top + L * .6, cx - hw, top); }
  else if (s === 'falchion') { p.moveTo(cx - hw * .8, top); p.lineTo(cx + hw * .8, top); p.lineTo(cx + hw * 1.5, bot - tip); p.quadraticCurveTo(cx + hw * 1.2, bot, cx - hw * .6, bot - 2); p.lineTo(cx - hw * .8, top); }
  else if (s === 'dadao') { p.moveTo(cx - hw * .8, top); p.lineTo(cx + hw * .8, top); p.quadraticCurveTo(cx + hw * 1.8, top + L * .7, cx + hw * 1.6, bot - 6); p.quadraticCurveTo(cx + hw, bot + 1, cx - hw * .9, bot - 8); p.lineTo(cx - hw * .8, top); }
  else if (s === 'single') { p.moveTo(cx - hw, top); p.lineTo(cx + hw, top); p.lineTo(cx + hw, bot - 2); p.lineTo(cx + hw - 2, bot); p.quadraticCurveTo(cx - hw, bot - tip * .8, cx - hw, bot - tip * 1.6); p.closePath(); }
  else if (s === 'leaf') { p.moveTo(cx - hw * .8, top); p.lineTo(cx + hw * .8, top); p.bezierCurveTo(cx + hw * 1.6, top + L * .4, cx + hw * 1.4, top + L * .75, cx, bot); p.bezierCurveTo(cx - hw * 1.4, top + L * .75, cx - hw * 1.6, top + L * .4, cx - hw * .8, top); }
  else if (s === 'broad') { p.moveTo(cx - hw * 1.2, top); p.lineTo(cx + hw * 1.2, top); p.lineTo(cx + hw * 1.1, bot - tip); p.lineTo(cx, bot); p.lineTo(cx - hw * 1.1, bot - tip); }
  else if (s === 'needle') { p.moveTo(cx - hw * .55, top); p.lineTo(cx + hw * .55, top); p.lineTo(cx + hw * .4, bot - tip * 1.2); p.lineTo(cx, bot); p.lineTo(cx - hw * .4, bot - tip * 1.2); }
  else if (s === 'cleaver') { p.moveTo(cx - hw * .7, top); p.lineTo(cx + hw * 1.9, top + 3); p.lineTo(cx + hw * 1.9, bot - tip); p.quadraticCurveTo(cx + hw * 1.6, bot - 2, cx - hw * .2, bot - tip * .6); p.lineTo(cx - hw * .7, top); }
  else if (s === 'flame' || s === 'wave') {
    const amp = s === 'flame' ? 2.4 : 1.9, waves = s === 'flame' ? 5 : 4, n = 40;
    for (let i = 0; i <= n; i++) { const t = i / n, y = top + (L - tip) * t, w = hw * (1 - t * .15) + Math.sin(t * Math.PI * waves) * amp; i ? p.lineTo(cx + w, y) : p.moveTo(cx + w, y); }
    p.lineTo(cx, bot);
    for (let i = n; i >= 0; i--) { const t = i / n, y = top + (L - tip) * t, w = hw * (1 - t * .15) + Math.sin(t * Math.PI * waves + (s === 'wave' ? 0 : Math.PI)) * amp; p.lineTo(cx - w, y); }
  } else if (s === 'crystal') {
    const pts = [[-hw, 0], [hw, 0], [hw + 2, .18], [hw - 1, .3], [hw + 2.5, .5], [hw - .5, .66], [hw + 1, .78], [0, 1], [-hw - 1, .8], [-hw + .5, .62], [-hw - 2, .46], [-hw + 1, .3], [-hw - 1.5, .15]];
    pts.forEach(([x, y], i) => i ? p.lineTo(cx + x, top + y * L) : p.moveTo(cx + x, top + y * L));
  } else if (s === 'serrated') {
    p.moveTo(cx - hw, top); p.lineTo(cx + hw, top);
    for (let i = 0; i < 9; i++) { const y = top + (L - tip) * i / 9; p.lineTo(cx + hw + 2.5, y + (L - tip) / 18); p.lineTo(cx + hw, y + (L - tip) / 9); }
    p.lineTo(cx, bot); p.lineTo(cx - hw, bot - tip);
  } else { p.moveTo(cx - hw, top); p.lineTo(cx + hw, top); p.lineTo(cx + hw, bot - tip); p.lineTo(cx, bot); p.lineTo(cx - hw, bot - tip); }
  p.closePath(); return p;
}
function guardPath(def, cx, y, k = 1) {
  const p = new Path2D(), t = def.guard, W = 1 * k;
  if (t === 'cross') { p.roundRect(cx - 17 * W, y, 34 * W, 5, 2); p.rect(cx - 19 * W, y - 2, 4, 9); p.rect(cx + 15 * W, y - 2, 4, 9); }
  else if (t === 'wings') { p.moveTo(cx - 3, y + 5); p.quadraticCurveTo(cx - 14 * W, y + 2, cx - 20 * W, y - 7); p.quadraticCurveTo(cx - 12 * W, y - 1, cx - 2, y); p.lineTo(cx + 2, y); p.quadraticCurveTo(cx + 12 * W, y - 1, cx + 20 * W, y - 7); p.quadraticCurveTo(cx + 14 * W, y + 2, cx + 3, y + 5); }
  else if (t === 'crescent' || t === 'crescent2') { p.moveTo(cx - 16 * W, y - 6); p.quadraticCurveTo(cx, y + 14, cx + 16 * W, y - 6); p.quadraticCurveTo(cx, y + 6, cx - 16 * W, y - 6); }
  else if (t === 'flame') { p.moveTo(cx - 14 * W, y + 4); for (let i = 0; i <= 6; i++) { const x = cx - 14 * W + i * 28 * W / 6; p.lineTo(x, y + (i % 2 ? -6 : 1)); } p.lineTo(cx + 14 * W, y + 5); }
  else if (t === 'icicle') { p.moveTo(cx - 15 * W, y); p.lineTo(cx + 15 * W, y); p.lineTo(cx + 12 * W, y + 9); p.lineTo(cx + 9 * W, y + 4); p.lineTo(cx + 5 * W, y + 11); p.lineTo(cx + 2, y + 4); p.lineTo(cx - 2, y + 4); p.lineTo(cx - 5 * W, y + 11); p.lineTo(cx - 9 * W, y + 4); p.lineTo(cx - 12 * W, y + 9); }
  else if (t === 'antlers') { p.roundRect(cx - 10, y, 20, 4, 2); for (const d of [-1, 1]) { p.moveTo(cx + d * 8, y + 1); p.lineTo(cx + d * 17 * W, y - 6); p.lineTo(cx + d * 15 * W, y - 9); p.lineTo(cx + d * 12, y - 4); p.lineTo(cx + d * 12, y - 10); p.lineTo(cx + d * 10, y - 3); p.lineTo(cx + d * 6, y); } }
  else if (t === 'shell') { p.moveTo(cx - 14 * W, y + 4); p.quadraticCurveTo(cx, y - 12, cx + 14 * W, y + 4); p.quadraticCurveTo(cx, y + 9, cx - 14 * W, y + 4); }
  else if (t === 'skull') { p.roundRect(cx - 15 * W, y + 1, 30 * W, 4, 2); p.ellipse(cx, y + 2, 6, 6, 0, 0, Math.PI * 2); }
  else if (t === 'sun') { p.arc(cx, y + 2, 7, 0, Math.PI * 2); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p.moveTo(cx + Math.cos(a) * 6, y + 2 + Math.sin(a) * 6); p.lineTo(cx + Math.cos(a + .2) * 15, y + 2 + Math.sin(a + .2) * 12); p.lineTo(cx + Math.cos(a - .2) * 15, y + 2 + Math.sin(a - .2) * 12); } p.roundRect(cx - 16, y, 32, 4, 2); }
  else if (t === 'cup') { p.moveTo(cx - 10, y - 1); p.quadraticCurveTo(cx, y + 11, cx + 10, y - 1); p.lineTo(cx + 9, y + 2); p.quadraticCurveTo(cx, y + 6, cx - 9, y + 2); p.closePath(); p.rect(cx - 10, y - 2, 20, 2.5); }
  else if (t === 'swept') { p.roundRect(cx - 14, y, 28, 3, 1.5); p.moveTo(cx - 12, y + 1); p.bezierCurveTo(cx - 16, y - 8, cx - 8, y - 18, cx - 3, y - 20); p.lineTo(cx - 2, y - 18); p.bezierCurveTo(cx - 7, y - 16, cx - 13, y - 8, cx - 9.5, y + 1); p.closePath(); p.arc(cx + 6, y + 5, 4, 0, Math.PI * 2); p.arc(cx + 6, y + 5, 2.4, 0, Math.PI * 2, true); }
  else if (t === 'basket') { p.moveTo(cx - 11, y + 4); p.bezierCurveTo(cx - 16, y - 6, cx - 12, y - 18, cx - 2, y - 21); p.lineTo(cx + 2, y - 21); p.lineTo(cx - 6, y - 14); p.bezierCurveTo(cx - 9, y - 6, cx - 7, y, cx + 10, y); p.lineTo(cx + 12, y + 4); p.closePath(); }
  else if (t === 'bow') { p.roundRect(cx - 13, y, 26, 3.5, 1.5); p.moveTo(cx - 11, y + 1); p.bezierCurveTo(cx - 14, y - 10, cx - 9, y - 20, cx - 2, y - 22); p.lineTo(cx - 1.5, y - 20); p.bezierCurveTo(cx - 7, y - 18, cx - 11, y - 10, cx - 8.5, y + 1); p.closePath(); }
  else if (t === 'ring') { p.roundRect(cx - 10, y, 20, 3.5, 1.5); p.arc(cx - 11, y + 2, 3.2, 0, Math.PI * 2); p.arc(cx + 11, y + 2, 3.2, 0, Math.PI * 2); }
  else if (t === 'tsuba') { p.ellipse(cx, y + 2, 8, 3.2, 0, 0, Math.PI * 2); }
  else if (t === 'disc') { p.ellipse(cx, y + 2, 9, 3.6, 0, 0, Math.PI * 2); p.rect(cx - 3, y + 2, 6, 3); }
  else { p.roundRect(cx - 14 * W, y, 28 * W, 5, 2); }
  return p;
}
function pommelPath(def, cx, y) {
  const p = new Path2D(), t = def.pommel;
  if (t === 'ring') { p.arc(cx, y, 5, 0, Math.PI * 2); p.arc(cx, y, 2.5, 0, Math.PI * 2, true); }
  else if (t === 'crescent') { p.arc(cx, y, 6, .3, Math.PI * 2 - .3); p.arc(cx + 3, y - 1, 4.5, Math.PI * 2 - .6, .6, true); }
  else if (t === 'flame') { p.moveTo(cx - 5, y + 4); p.quadraticCurveTo(cx - 6, y - 3, cx, y - 9); p.quadraticCurveTo(cx + 6, y - 3, cx + 5, y + 4); }
  else if (t === 'shard') { p.moveTo(cx, y - 9); p.lineTo(cx + 4, y); p.lineTo(cx, y + 5); p.lineTo(cx - 4, y); }
  else if (t === 'sun') { p.arc(cx, y, 5, 0, Math.PI * 2); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; p.moveTo(cx + Math.cos(a - .3) * 4, y + Math.sin(a - .3) * 4); p.lineTo(cx + Math.cos(a) * 9, y + Math.sin(a) * 9); p.lineTo(cx + Math.cos(a + .3) * 4, y + Math.sin(a + .3) * 4); } }
  else if (t === 'skull') { p.ellipse(cx, y - 1, 6, 5.5, 0, 0, Math.PI * 2); p.rect(cx - 3.5, y + 3, 7, 3); }
  else if (t === 'kashira') { p.roundRect(cx - 3.5, y - 2, 7, 5, 2); }
  else { p.arc(cx, y, 4.6, 0, Math.PI * 2); }
  return p;
}
// one sword, hilt at the top, tip down. layout scales with the canvas height.
export function drawBlade(def, w = 52, h = 150) {
  return pixelize(w, h, g => {
    const cx = w / 2 - (def.shape === 'curved' || def.shape === 'katana' || def.shape === 'dadao' || def.shape === 'falchion' || def.shape === 'cleaver' ? 3 : 0);
    const pomY = 9, gripTop = 12, guardY = gripTop + (def.gripLen ?? 22), bladeTop = guardY + 4, bot = bladeTop + (h - 3 - bladeTop) * (def.len ?? 1);
    const bw = def.bw ?? (def.shape === 'needle' ? 9 : def.shape === 'broad' ? 13 : 12), dec = def.decor, glow = def.glow;
    if (def.stick) {     // a plain wooden stick with a knot and a binding
      g.fillStyle = '#7a5030'; g.beginPath(); g.moveTo(cx - 3, 4); g.lineTo(cx + 2, 3); g.lineTo(cx + 3, bot); g.lineTo(cx - 2, bot); g.closePath(); g.fill();
      g.fillStyle = '#b88050'; g.fillRect(cx - 2, 5, 1.5, bot - 8); g.fillStyle = '#3a2410'; g.fillRect(cx + 1, 8, 1, bot - 12);
      g.fillStyle = '#5a3a1a'; g.beginPath(); g.ellipse(cx + 3, h * .45, 3, 2, 0, 0, 7); g.fill(); g.fillStyle = '#c8b07a'; for (let y = 22; y < 34; y += 3) g.fillRect(cx - 3, y, 6, 1.5);
      return;
    }
    const bp = bladePath(def, cx, bladeTop, bot, bw), [d0, d1, d2, d3] = def.blade;
    const grad = g.createLinearGradient(cx - 14, 0, cx + 14, 0); grad.addColorStop(0, d2); grad.addColorStop(.49, d2); grad.addColorStop(.5, d1); grad.addColorStop(1, d0);
    g.fillStyle = grad; g.fill(bp);
    g.save(); g.clip(bp);
    g.fillStyle = d3; g.fillRect(cx - 1.4, bladeTop + 2, 1.4, bot - bladeTop - 8);
    if (def.fuller) { g.fillStyle = d0; g.fillRect(cx + 1, bladeTop + 4, 1.2, (bot - bladeTop) * .7); }
    if (def.hamon) { g.strokeStyle = d3; g.lineWidth = 1; g.beginPath(); for (let y = bladeTop + 2; y < bot - 6; y += 1) g.lineTo(cx + bw * .25 + Math.sin(y / 3) * 1.2 + (y - bladeTop) * .05, y); g.stroke(); }
    if (dec === 'cracks') { g.strokeStyle = glow; g.lineWidth = 1; g.beginPath(); for (let y = bladeTop + 10; y < bot - 20; y += 18) { g.moveTo(cx + 1, y); g.lineTo(cx + 4, y + 5); g.lineTo(cx + 2, y + 10); } g.stroke(); }
    if (dec === 'frost') { g.fillStyle = '#ffffff'; for (let y = bladeTop + 8; y < bot - 14; y += 12) { g.fillRect(cx - 4, y, 1, 1); g.fillRect(cx + 3, y + 6, 1, 1); } }
    if (dec === 'vines') { g.strokeStyle = '#3a7a2a'; g.lineWidth = 1.4; g.beginPath(); for (let y = bladeTop; y < bot - 24; y += 1) g.lineTo(cx + Math.sin((y - bladeTop) / 6) * 4, y); g.stroke(); g.fillStyle = '#8ae06a'; for (let y = bladeTop + 6; y < bot - 30; y += 12) g.fillRect(cx + Math.sin((y - bladeTop) / 6) * 4 + 1, y, 2, 2); }
    if (dec === 'lightning') { g.strokeStyle = glow; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, bladeTop + 4); for (let y = bladeTop + 4, k = 0; y < bot - 20; y += 9, k++) g.lineTo(cx + (k % 2 ? 3 : -3), y + 9); g.stroke(); }
    if (dec === 'drips') { g.fillStyle = '#ff4a4a'; for (const [x, y, l] of [[-2, 30, 8], [2, 52, 6], [-1, 74, 10]]) g.fillRect(cx + x, bladeTop + y, 1, l); }
    if (dec === 'filigree') { g.strokeStyle = '#c8963f'; g.lineWidth = 1; for (let y = bladeTop + 6; y < bladeTop + 34; y += 8) { g.beginPath(); g.arc(cx, y, 3, Math.PI * .1, Math.PI * .9); g.stroke(); } }
    if (dec === 'stars') { for (let i = 0; i < 14; i++) { g.fillStyle = i % 3 ? glow : '#ffffff'; g.fillRect(cx - 4 + ((i * 37) % 9), bladeTop + 6 + ((i * 53) % Math.max(1, bot - bladeTop - 24)), 1, 1); } }
    if (dec === 'bubbles') { g.fillStyle = glow; for (let i = 0; i < 6; i++) g.fillRect(cx + (i % 2 ? 2 : -3), bladeTop + 10 + i * 14, 2, 2); }
    if (dec === 'smoke') { g.fillStyle = 'rgba(160,168,255,.9)'; for (let y = bladeTop + 10; y < bot - 24; y += 16) g.fillRect(cx - 2, y, 4, 1); }
    if (dec === 'rays') { g.fillStyle = '#ffffff'; for (let y = bladeTop + 5; y < bot - 20; y += 10) g.fillRect(cx - 3, y, 6, 1); }
    g.restore();
    // grip
    const [k0, k1] = def.grip, gw = def.gripW ?? 6; g.fillStyle = k0; g.fillRect(cx - gw / 2, gripTop, gw, guardY - gripTop);
    g.fillStyle = k1; for (let y = gripTop + 1; y < guardY - 1; y += 3) g.fillRect(cx - gw / 2, y, gw, 1.4);
    if (def.shape === 'katana') { g.fillStyle = '#e8e0d0'; for (let y = gripTop + 2; y < guardY - 2; y += 5) { g.fillRect(cx - 1.5, y, 3, 2); } }
    // guard and pommel in metal, with a gem
    const [m0, m1, m2] = def.metal, mg = g.createLinearGradient(0, guardY - 10, 0, guardY + 10); mg.addColorStop(0, m2); mg.addColorStop(.5, m1); mg.addColorStop(1, m0);
    g.fillStyle = mg; g.fill(guardPath(def, cx, guardY, Math.min(1, w / 52)));
    const pg = g.createLinearGradient(0, pomY - 9, 0, pomY + 6); pg.addColorStop(0, m2); pg.addColorStop(1, m0); g.fillStyle = pg; g.fill(pommelPath(def, cx, pomY));
    if (def.pommel === 'skull') { g.fillStyle = '#1a1210'; g.fillRect(cx - 3, pomY - 2, 2, 2); g.fillRect(cx + 1, pomY - 2, 2, 2); }
    g.fillStyle = def.gem; g.fillRect(cx - 1.5, guardY + .5, 3, 3); if (def.pommel === 'gem' || def.pommel === 'orb') g.fillRect(cx - 1.5, pomY - 1.5, 3, 3);
    g.fillStyle = '#ffffff'; g.fillRect(cx - 1.5, guardY + .5, 1, 1);
  });
}

// ---------- incoming strikes ----------
// A strike is a great sword filling its rectangle, hilt up, tip down: a broad steel blade with a fuller, a gold
// crossguard the full width with down-curled quillons and a ruby, a wrapped grip and a round pommel. Drawn at art
// resolution (a board cell is 16x24 art pixels) and snapped to pixels with an ink outline, like the blade icons.
export function drawStrikeSword(aw, ah) {
  aw = Math.max(10, Math.round(aw)); ah = Math.max(30, Math.round(ah));
  return pixelize(aw - 2, ah - 2, (g, w, h) => {
    const cx = w / 2, hilt = Math.max(15, Math.min(26, Math.round(h * .2))), pr = Math.max(2.5, Math.min(4.5, w * .16));
    const pomY = pr + .5, guardY = hilt - 3, gh = Math.max(3, Math.min(5, Math.round(h * .03))), top = guardY + gh, bot = h;
    const bw = Math.max(6, Math.min(w - 3, Math.round(w * .66))), hw = bw / 2, tip = Math.min(bw * 1.15, (bot - top) * .3);
    // blade
    const blade = new Path2D(); blade.moveTo(cx - hw, top); blade.lineTo(cx + hw, top); blade.lineTo(cx + hw, bot - tip); blade.lineTo(cx, bot); blade.lineTo(cx - hw, bot - tip); blade.closePath();
    const bg = g.createLinearGradient(cx - hw, 0, cx + hw, 0); bg.addColorStop(0, STEEL[3]); bg.addColorStop(.18, STEEL[2]); bg.addColorStop(.5, STEEL[2]); bg.addColorStop(.52, STEEL[1]); bg.addColorStop(1, STEEL[0]);
    g.fillStyle = bg; g.fill(blade);
    g.save(); g.clip(blade);
    const fw = Math.max(1, Math.round(bw * .14)); g.fillStyle = STEEL[0]; g.fillRect(Math.round(cx - fw / 2), top + 3, fw, (bot - top) * .62);     // fuller
    g.fillStyle = STEEL[3]; g.fillRect(Math.round(cx - fw / 2) - 1, top + 3, 1, (bot - top) * .62);
    g.fillStyle = '#ffffff'; g.fillRect(cx - hw, top, 1, bot - top - tip);                                                                  // edge glint
    g.restore();
    // crossguard: full width, quillons curling down, ruby in the middle
    const [m0, m1, m2] = GOLD3, gw = w - 1;
    const guard = new Path2D(); guard.roundRect(cx - gw / 2, guardY, gw, gh, 1.5);
    guard.rect(cx - gw / 2, guardY, 2.2, gh + 2.5); guard.rect(cx + gw / 2 - 2.2, guardY, 2.2, gh + 2.5);
    const gg = g.createLinearGradient(0, guardY, 0, guardY + gh + 2); gg.addColorStop(0, m2); gg.addColorStop(.45, m1); gg.addColorStop(1, m0); g.fillStyle = gg; g.fill(guard);
    const rr = Math.max(1.5, Math.min(3, gh * .55)); g.fillStyle = '#7a1420'; g.beginPath(); g.arc(cx, guardY + gh / 2, rr + .6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d43a44'; g.beginPath(); g.arc(cx, guardY + gh / 2, rr, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffd0c8'; g.fillRect(cx - rr * .5, guardY + gh / 2 - rr * .6, 1, 1);
    // grip, wrapped
    const gwid = Math.max(3, Math.min(6, Math.round(w * .22))), gy0 = pomY + pr * .6, gy1 = guardY;
    g.fillStyle = '#3a2414'; g.fillRect(cx - gwid / 2, gy0, gwid, gy1 - gy0);
    g.fillStyle = '#7a5030'; for (let y = gy0 + 1; y < gy1 - .5; y += 2.5) g.fillRect(cx - gwid / 2, y, gwid, 1.2);
    // pommel
    const pg = g.createLinearGradient(0, pomY - pr, 0, pomY + pr); pg.addColorStop(0, m2); pg.addColorStop(1, m0); g.fillStyle = pg;
    g.beginPath(); g.arc(cx, pomY, pr, 0, Math.PI * 2); g.fill(); g.fillStyle = m2; g.fillRect(cx - pr * .5, pomY - pr * .6, 1, 1);
  });
}
const strikeCache = new Map();
export function strikeSprite(aw, ah) { const k = Math.round(aw) + 'x' + Math.round(ah); let c = strikeCache.get(k); if (!c) { c = drawStrikeSword(aw, ah); strikeCache.set(k, c); if (strikeCache.size > 60) strikeCache.delete(strikeCache.keys().next().value); } return c; }

// ---------- the existing sword families, in the same pixel style ----------
const STEEL = ['#4a5260', '#9aa3b0', '#e4e8ee', '#ffffff'], LEGACY_STEEL = ['#4e4562', '#9486ad', '#d6cbe8', '#f6efff'];
const GOLD3 = ['#6a4210', '#c8963f', '#ffe9a0'], IRON3 = ['#3a3a44', '#7a7a88', '#c4c4d0'];
export const ENAMEL = ['#b7544f', '#c98045', '#dbc15b', '#6c9b6e', '#668fac', '#9475ad', '#e3ddcc', '#4d4950'];
const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join('');
export const FAMILIES = {
  foil: {shape: 'needle', len: .98, guard: 'cup', pommel: 'orb', bw: 7},
  'short-sword': {shape: 'straight', len: .6, guard: 'bar', pommel: 'orb', bw: 12, fuller: true},
  'long-sword': {shape: 'straight', len: 1, guard: 'cross', pommel: 'orb', bw: 11, fuller: true},
  rapier: {shape: 'needle', len: 1, guard: 'swept', pommel: 'orb', bw: 8},
  dirk: {shape: 'straight', len: .52, guard: 'bar', pommel: 'ring', bw: 11},
  scimitar: {shape: 'curved', len: .82, guard: 'crescent2', pommel: 'orb', bw: 11},
  cutlass: {shape: 'curved', len: .72, guard: 'basket', pommel: 'orb', bw: 13},
  poniard: {shape: 'straight', len: .6, guard: 'ring', pommel: 'orb', bw: 10},
  saber: {shape: 'curved', len: .95, guard: 'bow', pommel: 'orb', bw: 10},
  stiletto: {shape: 'needle', len: .62, guard: 'bar', pommel: 'orb', bw: 7},
  'skull-dagger': {shape: 'straight', len: .52, guard: 'bar', pommel: 'skull', bw: 11},
  falchion: {shape: 'falchion', len: .78, guard: 'cross', pommel: 'orb', bw: 12},
  cleaver: {shape: 'cleaver', len: .62, guard: 'bar', pommel: 'ring', bw: 12},
  backsword: {shape: 'single', len: .9, guard: 'basket', pommel: 'orb', bw: 11},
  katana: {shape: 'katana', len: .92, guard: 'tsuba', pommel: 'kashira', bw: 8, gripLen: 30, gripW: 5, hamon: true},
  dadao: {shape: 'dadao', len: .82, guard: 'disc', pommel: 'ring', bw: 13, gripLen: 28},
  stick: {stick: true},
  custom: {shape: 'straight', len: .85, guard: 'cross', pommel: 'gem', bw: 11, fuller: true},
};
export function swordDef(id, primary = 0, secondary = 0) {
  const themed = BLADES.find(b => b.id === id); if (themed) return themed;
  const legacy = id === 'sinners-saber' || id === 'forgotten-falchion', fam = id === 'sinners-saber' ? 'saber' : id === 'forgotten-falchion' ? 'falchion' : FAMILIES[id] ? id : 'custom';
  const g = ENAMEL[primary] ?? ENAMEL[0], q = ENAMEL[secondary] ?? ENAMEL[0];
  return {...FAMILIES[fam], blade: legacy ? LEGACY_STEEL : STEEL, metal: id === 'skull-dagger' || id === 'dirk' ? IRON3 : GOLD3, grip: [shade(q, .45), q], gem: g, glow: '#ffffff', decor: legacy ? 'stars' : 'none', guardTint: g};
}
const iconCache = new Map();
export function swordIconURL(id, primary = 0, secondary = 0) {
  const key = id + ':' + primary + ':' + secondary; if (iconCache.has(key)) return iconCache.get(key);
  const url = drawBlade(swordDef(id, primary, secondary), 50, 100).toDataURL(); iconCache.set(key, url); return url;
}

// ---------- Adventure icons ----------
const G = {gold: ['#6a4210', '#c8963f', '#ffe9a0'], steel: ['#4a5260', '#a8b0bc', '#f0f4f8'], ruby: ['#5a0a14', '#c42a34', '#ff8a7a'], emer: ['#0a3a1a', '#2a9a44', '#9aff8a'], saph: ['#0a1a4a', '#2a6ad4', '#9ad8ff'], wood: ['#3a2410', '#7a5030', '#b88050']};
const lg = (g, c, y0, y1) => { const q = g.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, c[2]); q.addColorStop(.5, c[1]); q.addColorStop(1, c[0]); return q; };
function swordShape(g, x, y, len, ang, c = G.steel) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = lg(g, c, -2, 2); g.beginPath(); g.moveTo(-1.6, 0); g.lineTo(1.6, 0); g.lineTo(1.6, len - 4); g.lineTo(0, len); g.lineTo(-1.6, len - 4); g.closePath(); g.fill();
  g.fillStyle = c[2]; g.fillRect(-.8, 1, .8, len - 6);
  g.fillStyle = lg(g, G.gold, -2, 2); g.fillRect(-5, -2, 10, 2.4); g.fillStyle = G.wood[1]; g.fillRect(-1.2, -7, 2.4, 5); g.fillStyle = G.gold[2]; g.beginPath(); g.arc(0, -8, 1.8, 0, 7); g.fill();
  g.restore();
}
function gemShape(g, x, y, r, c) { g.fillStyle = c[1]; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y - r * .2); g.lineTo(x, y + r); g.lineTo(x - r, y - r * .2); g.closePath(); g.fill(); g.fillStyle = c[2]; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .5, y - r * .2); g.lineTo(x, y + r * .1); g.lineTo(x - r * .5, y - r * .2); g.closePath(); g.fill(); g.fillStyle = c[0]; g.beginPath(); g.moveTo(x + r, y - r * .2); g.lineTo(x, y + r); g.lineTo(x + r * .2, y); g.closePath(); g.fill(); }
export const ICONS = {
  // upgrades
  'clear-value': g => { gemShape(g, 14, 15, 10, G.emer); g.fillStyle = G.gold[2]; g.fillRect(22, 4, 2, 8); g.fillRect(19, 7, 8, 2); },
  'chain-value': g => { g.lineWidth = 3; for (const [x, y, c] of [[9, 20, G.gold], [16, 14, G.steel], [23, 8, G.gold]]) { g.strokeStyle = c[1]; g.beginPath(); g.ellipse(x, y, 6, 4, -.7, 0, 7); g.stroke(); g.strokeStyle = c[2]; g.lineWidth = 1; g.beginPath(); g.ellipse(x - .5, y - .5, 6, 4, -.7, 3.4, 5); g.stroke(); g.lineWidth = 3; } },
  'breaker-supply': g => { g.fillStyle = lg(g, G.wood, 14, 28); g.fillRect(4, 16, 24, 12); g.fillStyle = G.wood[0]; g.fillRect(4, 21, 24, 1); g.fillRect(15, 16, 2, 12); for (const [x, c] of [[9, G.ruby], [16, G.saph], [23, G.emer]]) { g.fillStyle = c[2]; g.beginPath(); g.moveTo(x, 3); g.lineTo(x + 2, 9); g.lineTo(x + 1, 16); g.lineTo(x - 1, 16); g.lineTo(x - 2, 9); g.closePath(); g.fill(); } },
  'breathing-room': g => { g.fillStyle = lg(g, G.wood, 2, 30); g.fillRect(7, 3, 18, 3); g.fillRect(7, 26, 18, 3); g.fillStyle = '#cfe8ff'; g.beginPath(); g.moveTo(9, 6); g.lineTo(23, 6); g.lineTo(17, 16); g.lineTo(23, 26); g.lineTo(9, 26); g.lineTo(15, 16); g.closePath(); g.fill(); g.fillStyle = G.gold[2]; g.beginPath(); g.moveTo(11, 25); g.lineTo(21, 25); g.lineTo(16, 19); g.closePath(); g.fill(); g.fillRect(15.5, 14, 1, 6); },
  'extra-sprinkles': g => { for (const [x, y, c, r] of [[9, 10, G.ruby, 5], [21, 9, G.emer, 4], [14, 21, G.saph, 5], [24, 22, G.gold, 4], [6, 23, G.emer, 3]]) gemShape(g, x, y, r, c); },
  'taller-swords': g => { swordShape(g, 12, 9, 20, 0); g.fillStyle = G.gold[2]; g.beginPath(); g.moveTo(24, 3); g.lineTo(29, 10); g.lineTo(26, 10); g.lineTo(26, 18); g.lineTo(22, 18); g.lineTo(22, 10); g.lineTo(19, 10); g.closePath(); g.fill(); },
  'bank-points': g => { for (let i = 0; i < 4; i++) { g.fillStyle = lg(g, G.gold, 22 - i * 4, 26 - i * 4); g.beginPath(); g.ellipse(13, 24 - i * 4, 8, 3, 0, 0, 7); g.fill(); } g.fillStyle = lg(g, G.gold, 6, 22); g.beginPath(); g.ellipse(23, 18, 6, 6, 0, 0, 7); g.fill(); g.fillStyle = G.gold[0]; g.fillRect(22, 15, 2, 6); },
  // encounters
  duel: g => { swordShape(g, 8, 6, 22, -.75); swordShape(g, 24, 6, 22, .75); },
  precision: g => { g.lineWidth = 2.4; for (const [r, c] of [[12, G.ruby[1]], [8, '#e8dcc0'], [4, G.ruby[1]]]) { g.strokeStyle = c; g.beginPath(); g.arc(16, 16, r, 0, 7); g.stroke(); } g.fillStyle = G.gold[2]; g.fillRect(15, 15, 2, 2); },
  'clear-sprint': g => { g.fillStyle = lg(g, G.gold, 2, 30); g.beginPath(); g.moveTo(19, 2); g.lineTo(7, 18); g.lineTo(15, 18); g.lineTo(11, 30); g.lineTo(25, 12); g.lineTo(17, 12); g.closePath(); g.fill(); },
  'chain-route': g => ICONS['chain-value'](g),
  hold: g => { g.fillStyle = lg(g, G.steel, 3, 29); g.beginPath(); g.moveTo(16, 3); g.lineTo(27, 7); g.quadraticCurveTo(27, 22, 16, 29); g.quadraticCurveTo(5, 22, 5, 7); g.closePath(); g.fill(); g.fillStyle = G.ruby[1]; g.beginPath(); g.moveTo(16, 7); g.lineTo(23, 9.5); g.quadraticCurveTo(23, 20, 16, 25); g.closePath(); g.fill(); g.fillStyle = G.gold[2]; g.fillRect(15, 7, 2, 18); },
  premium: g => { g.fillStyle = lg(g, G.gold, 6, 26); g.beginPath(); g.moveTo(5, 24); g.lineTo(5, 10); g.lineTo(11, 16); g.lineTo(16, 6); g.lineTo(21, 16); g.lineTo(27, 10); g.lineTo(27, 24); g.closePath(); g.fill(); gemShape(g, 16, 19, 3.5, G.ruby); gemShape(g, 9, 20, 2.5, G.saph); gemShape(g, 23, 20, 2.5, G.emer); },
  // relics of the Long Road
  'miners-tithe': g => { g.fillStyle = lg(g, G.wood, 6, 28); g.beginPath(); g.moveTo(6, 12); g.lineTo(26, 12); g.lineTo(23, 28); g.lineTo(9, 28); g.closePath(); g.fill(); g.fillStyle = G.wood[0]; g.fillRect(6, 11, 20, 2.5); for (const [x, y] of [[11, 9], [16, 7], [21, 9]]) { g.fillStyle = lg(g, G.gold, y - 3, y + 3); g.beginPath(); g.ellipse(x, y, 3.4, 3.4, 0, 0, 7); g.fill(); } g.strokeStyle = G.steel[1]; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 26); g.lineTo(30, 6); g.stroke(); g.fillStyle = G.steel[2]; g.fillRect(26, 4, 6, 2.5); },
  'ward-charm': g => { g.strokeStyle = G.gold[1]; g.lineWidth = 1.5; g.beginPath(); g.moveTo(16, 1); g.lineTo(16, 6); g.stroke(); g.fillStyle = lg(g, G.saph, 6, 30); g.beginPath(); g.moveTo(16, 6); g.lineTo(26, 13); g.lineTo(22, 28); g.lineTo(10, 28); g.lineTo(6, 13); g.closePath(); g.fill(); g.strokeStyle = G.gold[2]; g.lineWidth = 1.6; g.stroke(); g.fillStyle = '#e8f6ff'; g.beginPath(); g.arc(16, 17, 4, 0, 7); g.fill(); g.fillStyle = G.saph[0]; g.beginPath(); g.arc(16, 17, 2, 0, 7); g.fill(); },
  'broad-edge': g => { g.fillStyle = lg(g, G.steel, 4, 28); g.beginPath(); g.moveTo(8, 8); g.lineTo(24, 8); g.lineTo(24, 22); g.lineTo(16, 30); g.lineTo(8, 22); g.closePath(); g.fill(); g.fillStyle = G.steel[2]; g.fillRect(9, 9, 6, 13); g.fillStyle = lg(g, G.gold, 4, 8); g.fillRect(4, 5, 24, 3.4); g.fillStyle = G.wood[1]; g.fillRect(14, 0, 4, 5); g.fillStyle = G.gold[2]; for (const x of [2, 28]) { g.beginPath(); g.moveTo(x, 18); g.lineTo(x + (x < 16 ? 4 : -4), 15); g.lineTo(x + (x < 16 ? 4 : -4), 21); g.closePath(); g.fill(); } },
  'second-wind': g => { g.strokeStyle = '#d8f4ff'; g.lineCap = 'round'; for (const [y, l, w] of [[8, 20, 3], [15, 24, 3.4], [22, 16, 3]]) { g.lineWidth = w; g.beginPath(); g.moveTo(4, y); g.lineTo(4 + l, y); g.arc(4 + l, y - 3, 3, Math.PI / 2, -Math.PI, true); g.stroke(); } g.fillStyle = G.gold[2]; g.beginPath(); g.moveTo(26, 22); g.lineTo(29, 26); g.lineTo(26, 30); g.lineTo(23, 26); g.closePath(); g.fill(); },
  'blood-pact': g => { g.fillStyle = lg(g, G.ruby, 3, 29); g.beginPath(); g.moveTo(16, 3); g.bezierCurveTo(26, 14, 26, 28, 16, 29); g.bezierCurveTo(6, 28, 6, 14, 16, 3); g.fill(); g.fillStyle = G.ruby[2]; g.beginPath(); g.ellipse(12.5, 19, 2, 4, -.3, 0, 7); g.fill(); g.strokeStyle = G.gold[1]; g.lineWidth = 2; g.beginPath(); g.arc(16, 20, 10, 3.6, 5.8); g.stroke(); },
  'echo-crown': g => { g.fillStyle = lg(g, G.gold, 10, 24); g.beginPath(); g.moveTo(5, 24); g.lineTo(5, 13); g.lineTo(11, 18); g.lineTo(16, 10); g.lineTo(21, 18); g.lineTo(27, 13); g.lineTo(27, 24); g.closePath(); g.fill(); g.fillStyle = '#fff4a0'; g.beginPath(); g.moveTo(19, 0); g.lineTo(12, 8); g.lineTo(16, 8); g.lineTo(13, 14); g.lineTo(21, 5); g.lineTo(17, 5); g.closePath(); g.fill(); gemShape(g, 16, 21, 2.6, G.saph); },
  checkpoint: g => { g.fillStyle = G.wood[1]; g.fillRect(7, 3, 2.5, 26); g.fillStyle = lg(g, G.ruby, 4, 18); g.beginPath(); g.moveTo(9.5, 4); g.lineTo(26, 8); g.lineTo(9.5, 15); g.closePath(); g.fill(); g.fillStyle = G.gold[2]; g.fillRect(4, 27, 9, 2.5); },
};
export function drawIcon(id, size = 32) { const f = ICONS[id]; return f ? pixelize(size, size, (g, w) => { g.scale(w / 32, w / 32); f(g); }) : null; }
