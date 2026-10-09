// Sizes a mode's boards to the window: as tall as the space under their header allows without
// scrolling the page, centred by the layout around them. Sets --fit-w (one board's width) on the
// container. Any board made of a header, a .board-frame holding the 4:13 canvas, and a foot works.
// On narrow screens (stacked layouts) it clears the variable and leaves sizing to the stylesheet.
export function fitBoards(container, {board, min = 130, max = 330, room = null, app = document.getElementById('app'), narrowBelow = 1000} = {}) {
  if (!container) return null;
  if (innerWidth < narrowBelow) { container.style.removeProperty('--fit-w'); return null; }
  const b = container.querySelector(board), f = b?.querySelector('.board-frame'), c = f?.querySelector('canvas'); if (!c) return null;
  const r = el => el.getBoundingClientRect();
  const foot = r(b).bottom - r(f).bottom, ph = f.offsetHeight - c.offsetHeight, pw = f.offsetWidth - c.offsetWidth;
  const sh = document.documentElement.scrollHeight, below = app ? (sh > innerHeight ? Math.max(0, sh - (r(app).bottom + scrollY)) : 0) + parseFloat(getComputedStyle(app).paddingBottom || 0) : 16;
  const fh = innerHeight - (r(f).top + scrollY) - foot - Math.max(10, below + 2);
  let w = (fh - ph) * 4 / 13 + pw;
  if (room) w = Math.min(w, room());
  w = Math.round(Math.max(min, Math.min(max, w)));
  container.style.setProperty('--fit-w', w + 'px');
  return w;
}
