// Connection to the Scraps online server. Reconnects with backoff and resumes the same seat
// (the server holds it for 20 s), measures round-trip time, and queues sends while offline.
import {ONLINE_URL} from './online-config.js';

// The build this page was loaded with (served by server.mjs); the relay turns away out-of-date pages.
let BUILD = null;
try { fetch(new URL('build.json', location.href), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(j => { BUILD = j?.build ?? null; }).catch(() => {}); } catch {}

export function onlineURL() {
  try { const q = new URLSearchParams(location.search).get('server'); if (q) { localStorage.setItem('scraps.online-url', JSON.stringify(q)); return q; } } catch {}
  try { const saved = JSON.parse(localStorage.getItem('scraps.online-url') || 'null'); if (saved) return saved; } catch {}
  if (ONLINE_URL) return ONLINE_URL;
  if (BUILD && /^https?:$/.test(location.protocol)) return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;   // served by server.mjs: its relay is right here
  const local = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(location.hostname) || location.hostname.endsWith('.local');
  return local ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws` : '';
}

export function connectOnline({url = onlineURL(), hello}) {
  const handlers = new Map(), queue = [];
  let ws = null, token = null, closed = false, tries = 0, timer = null, pingTimer = null, rtt = null, status = 'connecting', id = null;
  const emit = (type, msg) => { for (const fn of handlers.get(type) || []) try { fn(msg); } catch (e) { console.error(e); } };
  const setStatus = s => { if (status !== s) { status = s; emit('status', {status, rtt}); } };
  function open() {
    if (closed) return;
    if (!url) { setStatus('no-server'); return; }
    setStatus(tries ? 'reconnecting' : 'connecting');
    try { ws = new WebSocket(url); } catch { return retry(); }
    ws.onopen = () => { tries = 0; ws.send(JSON.stringify({...hello(), t: 'hello', token, build: BUILD})); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') { token = m.token; id = m.id; setStatus('online'); for (const q of queue.splice(0)) ws.send(q); ping(); }
      if (m.t === 'pong') { rtt = Math.round(performance.now() - m.at); emit('status', {status, rtt}); return; }
      emit(m.t, m); emit('*', m);
    };
    ws.onclose = () => { ws = null; if (!closed) retry(); };
    ws.onerror = () => {};
  }
  function retry() { setStatus('reconnecting'); clearTimeout(timer); timer = setTimeout(open, Math.min(8000, 400 * 2 ** tries++)); }
  function ping() { clearTimeout(pingTimer); if (ws?.readyState === 1) ws.send(JSON.stringify({t: 'ping', at: performance.now()})); pingTimer = setTimeout(ping, 4000); }
  open();
  return {
    send(msg) { const text = JSON.stringify(msg); if (ws?.readyState === 1 && status === 'online') ws.send(text); else if (msg.t !== 'state' && queue.length < 50) queue.push(text); },
    on(type, fn) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(fn); return () => handlers.get(type).delete(fn); },
    close() { closed = true; clearTimeout(timer); clearTimeout(pingTimer); try { ws?.send(JSON.stringify({t: 'leave'})); } catch {} ws?.close(); },
    _drop() { try { ws?.close(); } catch {} },   // QA: simulate a dropped connection
    get status() { return status; }, get rtt() { return rtt; }, get id() { return id; }, get url() { return url; },
  };
}
