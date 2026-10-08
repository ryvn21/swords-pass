// Minimal WebSocket server (RFC 6455) on top of node:http, so the game needs no npm packages.
// Text frames only, fragmented messages reassembled, ping/pong heartbeat, 64 KB message cap.
import {createHash} from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', MAX = 64 * 1024;

function frame(op, payload) {
  const len = payload.length, head = len < 126 ? 2 : len < 65536 ? 4 : 10, out = Buffer.alloc(head + len);
  out[0] = 0x80 | op;
  if (len < 126) out[1] = len;
  else if (len < 65536) { out[1] = 126; out.writeUInt16BE(len, 2); }
  else { out[1] = 127; out.writeBigUInt64BE(BigInt(len), 2); }
  payload.copy(out, head); return out;
}

// Attach to an http.Server. onConnection(socketWrapper, request) is called for each accepted
// upgrade on `path`. The wrapper has send(string), close(), onMessage, onClose, remote.
export function attachWebSockets(server, {path = '/ws', onConnection, heartbeatMs = 20000} = {}) {
  const live = new Set();
  server.on('upgrade', (req, sock) => {
    let url; try { url = new URL(req.url, 'http://x'); } catch { sock.destroy(); return; }
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== path || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
    const accept = createHash('sha1').update(key + GUID).digest('base64');
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    sock.setNoDelay(true);
    const ws = {
      remote: req.headers['x-forwarded-for']?.split(',')[0].trim() || sock.remoteAddress, open: true, alive: true,
      onMessage: () => {}, onClose: () => {},
      send(text) { if (ws.open) try { sock.write(frame(1, Buffer.from(text))); } catch {} },
      ping() { if (ws.open) try { sock.write(frame(9, Buffer.alloc(0))); } catch {} },
      close(code = 1000) { if (!ws.open) return; const b = Buffer.alloc(2); b.writeUInt16BE(code); try { sock.write(frame(8, b)); } catch {} sock.end(); finish(); },
    };
    let buf = Buffer.alloc(0), parts = [], partLen = 0, done = false;
    const finish = () => { if (done) return; done = true; ws.open = false; live.delete(ws); try { ws.onClose(); } catch {} };
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; const big = buf.readBigUInt64BE(2); if (big > BigInt(MAX)) { ws.close(1009); return; } len = Number(big); off = 10; }
        if (len > MAX || !masked) { ws.close(len > MAX ? 1009 : 1002); return; }
        if (buf.length < off + 4 + len) return;
        const mask = buf.subarray(off, off + 4), data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
        for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
        buf = buf.subarray(off + 4 + len);
        if (op === 8) { ws.close(); return; }
        if (op === 9) { try { sock.write(frame(10, data)); } catch {} continue; }
        if (op === 10) { ws.alive = true; continue; }
        if (op === 1 || op === 2 || op === 0) {
          parts.push(data); partLen += data.length; if (partLen > MAX) { ws.close(1009); return; }
          if (fin) { const text = Buffer.concat(parts).toString('utf8'); parts = []; partLen = 0; ws.alive = true; try { ws.onMessage(text); } catch {} }
        }
      }
    });
    sock.on('close', finish); sock.on('error', finish); sock.on('end', finish);
    live.add(ws); onConnection?.(ws, req);
  });
  const beat = setInterval(() => {
    for (const ws of live) { if (!ws.alive) { ws.close(1001); continue; } ws.alive = false; ws.ping(); }
  }, heartbeatMs);
  beat.unref?.();
  return {close() { clearInterval(beat); for (const ws of live) ws.close(1001); }, get count() { return live.size; }};
}
