# Sword's Pass online server

Online Duel and Online Free-for-All need this small relay running somewhere the players can reach.
It has no npm dependencies (Node 20+).

| Command | What it does |
|---|---|
| `npm run dev` | The game **and** the relay at `ws://127.0.0.1:4173/ws`. Two browser windows can play each other. |
| `HOST=0.0.0.0 npm run dev` | Same, reachable from other machines on your network (`http://<your-PC-ip>:4173`). |
| `npm run online` | The relay only, on port 8787 (`PORT`, `HOST`, `ALLOWED_ORIGINS` env vars). `GET /health` reports players and rooms. |

## Putting it online (live site)

The live game is one Render web service running `server.mjs`: the game files and the relay on the same
address, so online play needs no extra setup (`render.yaml` describes it).

- **Going live:** push to `main` on GitHub. Render redeploys in a minute or two; `/health` shows the
  running build. Day-to-day work happens locally (`npm run dev`) and is only pushed when it's ready.
- **Players with the page open during a deploy** are asked to refresh before they can play online, so
  nobody plays against a different build (`/build.json`, checked by the relay).
- **Free plan:** the service sleeps after ~15 idle minutes; the first visitor then waits up to a minute.
  Render's Starter plan (about $7/month) keeps it awake.
- **Own domain (optional):** add it in Render (Settings, Custom Domains) and point the DNS record it shows.
- **Desktop app:** `desktop/` is a Windows app that opens the live site, so it always has the latest game.
  Build it from GitHub Actions ("Desktop app" workflow). If the site address changes, update `site` in
  `desktop/package.json` and rebuild. Browsers can also install the site as an app (the install icon in
  the address bar).
- **Elsewhere:** `npm run online` runs just the relay, for a game hosted as static files; point the game
  at it with `ONLINE_URL` in `dist/online-config.js` or `?server=wss://host/ws`.

## How it plays

Each player simulates their own board locally (engine mode `online`), so controls have no network delay.
The relay passes board snapshots (about 20 a second) and attack batches; attacks land on the receiver's
next lock, as they do offline. The relay referees results: the first player to top out loses the duel,
and in Free-for-All the last board standing wins (shared hazard waves rise for everyone).
Dropped connections resume within 20 seconds; after that the player forfeits.
Online matches use the standard timings for fairness; only each player's held-movement delay and
repeat (input feel) come from their own settings.
