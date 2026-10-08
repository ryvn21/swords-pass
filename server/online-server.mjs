// Standalone online server for deployment: just the relay, no game files.
//   PORT=8787 node server/online-server.mjs
// Put it behind HTTPS (Caddy, nginx, Fly, Render...) so the game can reach it at wss://your-host/ws.
// ALLOWED_ORIGINS (comma separated) limits which sites may connect; empty allows any.
import http from 'node:http';
import {attachWebSockets} from './ws.mjs';
import {createRelay} from './relay.mjs';

const port = Number(process.env.PORT || 8787), host = process.env.HOST || '0.0.0.0';
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const relay = createRelay({log: (...a) => console.error(...a)});
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}); res.end(JSON.stringify({ok: true, ...relay.stats()})); return; }
  res.writeHead(404).end('Scraps online server');
});
attachWebSockets(server, {path: '/ws', onConnection(ws, req) {
  if (allowed.length && !allowed.includes(req.headers.origin)) { ws.close(1008); return; }
  relay.connect(ws);
}});
server.listen(port, host, () => console.log(`Scraps online server on ${host}:${port} (ws path /ws)`));
