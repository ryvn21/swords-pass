// Sword's Pass server: the game files and the online relay (ws://<host>/ws) in one process.
//   npm run dev                      local, http://127.0.0.1:4173
//   HOST=0.0.0.0 PORT=xxxx node server.mjs   production (Render sets PORT; see README "Putting it online")
import http from 'node:http';
import {readFile, stat, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {resolve, extname, sep, relative} from 'node:path';
import {attachWebSockets} from './server/ws.mjs';
import {createRelay} from './server/relay.mjs';
import {createPresence} from './server/presence.mjs';
const presence = createPresence();
import {createScores} from './server/scores.mjs';
import {createCommunity} from './server/community.mjs';

const root = resolve('dist');
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'};
const textual = new Set(['.html', '.js', '.css', '.svg', '.json', '.webmanifest', '.txt']);

// A fingerprint of the game's code: online play only pairs players on the same build, and a page
// left open across a deploy is told to refresh instead of desyncing against newer players.
async function fingerprint(dir) {
  const h = createHash('sha1');
  const walk = async d => { for (const e of (await readdir(d, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = resolve(d, e.name); if (e.isDirectory()) await walk(p); else if (/\.(js|mjs)$/.test(e.name)) h.update(relative(dir, p)).update(await readFile(p)); } };
  await walk(dir); return h.digest('hex').slice(0, 12);
}
const BUILD = await fingerprint(root);

const cache = new Map();   // path -> {mtime, body, gz, etag}
async function load(file) {
  const s = await stat(file); if (!s.isFile()) throw Error('not a file');
  const hit = cache.get(file); if (hit && hit.mtime === s.mtimeMs) return hit;
  const body = await readFile(file), ext = extname(file);
  const entry = {mtime: s.mtimeMs, body, gz: textual.has(ext) && body.length > 1024 ? gzipSync(body) : null, etag: `"${s.size.toString(36)}-${Math.floor(s.mtimeMs).toString(36)}"`};
  cache.set(file, entry); return entry;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') { res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify({ok: true, build: BUILD, scores: scores.remote ? 'supabase' : 'memory', ...relay.stats()})); return; }
  if (url.pathname === '/api/lobby') { res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(relay.lobby())); return; }
  // presence: POST {id, a} with what this page is doing; answers (and GET answers) with the counts
  if (url.pathname === '/api/presence') {
    const head = {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'};
    if (req.method === 'OPTIONS') { res.writeHead(204, head).end(); return; }
    if (req.method === 'POST') {
      let body = ''; req.setEncoding('utf8');
      req.on('data', d => { body += d; if (body.length > 300) req.destroy(); });
      req.on('end', () => { try { const m = JSON.parse(body); presence.report(String(m.id), String(m.a)); } catch {} res.writeHead(200, head); res.end(JSON.stringify(presence.counts())); });
      return;
    }
    res.writeHead(200, head); res.end(JSON.stringify(presence.counts())); return;
  }
  // community blades: GET lists them; POST shares one; POST /use counts a copy; POST /remove takes your own down
  if (url.pathname === '/api/community' || url.pathname === '/api/community/use' || url.pathname === '/api/community/remove') {
    const head = {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'};
    if (req.method === 'OPTIONS') { res.writeHead(204, head).end(); return; }
    await community.ready;
    if (req.method === 'GET') { res.writeHead(200, head); res.end(JSON.stringify(community.list({sort: url.searchParams.get('sort') || 'new'}))); return; }
    if (req.method !== 'POST') { res.writeHead(405, head).end(); return; }
    let body = ''; req.setEncoding('utf8');
    req.on('data', d => { body += d; if (body.length > 2000) req.destroy(); });
    req.on('end', () => {
      let out = {ok: false, error: 'Something went wrong.'};
      try {
        const m = JSON.parse(body), address = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim();
        if (url.pathname.endsWith('/use')) out = {ok: community.use(String(m.id))};
        else if (url.pathname.endsWith('/remove')) out = {ok: community.remove(String(m.id), String(m.pid || ''))};
        else out = community.share(m, address);
      } catch {}
      res.writeHead(200, head); res.end(JSON.stringify(out));
    });
    return;
  }
  if (url.pathname === '/build.json') { res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify({build: BUILD})); return; }
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const file = path === root ? resolve(root, 'index.html') : path, ext = extname(file);
    const f = await load(file);
    // code and pages revalidate every load (a deploy shows up straight away); art and music may be kept for an hour
    const headers = {'Content-Type': mime[ext] || 'application/octet-stream', ETag: f.etag, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
      'Cache-Control': textual.has(ext) ? 'no-cache' : 'public, max-age=3600', Vary: 'Accept-Encoding'};
    if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, headers).end(); return; }
    const gz = f.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gz) headers['Content-Encoding'] = 'gzip';
    const body = gz ? f.gz : f.body; headers['Content-Length'] = body.length;
    res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Not found'); }
});

// Online play. A few connections per address is plenty for real players and keeps one visitor from filling the server.
// Results and ratings: saved to Supabase when SUPABASE_URL / SUPABASE_SERVICE_KEY are set (see server/supabase.sql).
const scores = createScores({log: (...a) => console.error(...a)});
const community = createCommunity({log: (...a) => console.error(...a)});
const relay = createRelay({build: BUILD, scores, log: (...a) => console.error(...a)});
const perAddress = new Map(), MAX_PER_ADDRESS = 12, MAX_TOTAL = 2000;
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const sockets = attachWebSockets(server, {path: '/ws', onConnection(ws, req) {
  const ip = ws.remote || '?', n = perAddress.get(ip) || 0;
  if ((allowed.length && !allowed.includes(req.headers.origin)) || n >= MAX_PER_ADDRESS || sockets.count > MAX_TOTAL) { ws.close(1008); return; }
  perAddress.set(ip, n + 1);
  relay.connect(ws);
  const closed = ws.onClose; ws.onClose = () => { const k = (perAddress.get(ip) || 1) - 1; if (k > 0) perAddress.set(ip, k); else perAddress.delete(ip); closed(); };
}});

const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 4173);
server.listen(port, host, () => console.log(`Sword's Pass: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}  (online play on /ws, build ${BUILD})`));
const stop = () => { sockets.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
