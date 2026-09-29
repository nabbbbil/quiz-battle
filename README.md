# Quiz Battle

A Kahoot-style multiplayer math quiz. Players join a room from their phones with a 4-letter code and race to answer. The server makes the questions, runs the timer and decides the scores.

Built with [Colyseus 0.18](https://docs.colyseus.io/) (Node + TypeScript), React 19, Vite 8 and Tailwind 4. The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. In dev, Vite serves the client **and** runs the game server on that same port. The Colyseus playground is at http://localhost:5173/playground and the monitor at `/monitor`.

To play from a phone on the same Wi-Fi, run `npm run dev -- --host` and open the Network URL it prints.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Client + server with hot reload, one port (5173) |
| `npm test` | Vitest, once. `npm run test:watch` re-runs on save |
| `npm run typecheck` | `tsc` over the whole project |
| `npm run build` | Client to `dist/client/`, server to `dist/server/server.mjs` |
| `npm run build:client` | Client only, for Vercel |
| `npm run sample-questions` | Prints a sample 10-round game per age group |
| `npm run loadtest` | Simulated clients with `@colyseus/loadtest` |

## Layout

```
index.html                 client HTML entry
vite.config.ts             React, Tailwind, and the colyseus/vite plugin (runs the server inside Vite in dev)
vitest.config.ts           test config, kept apart so tests don't boot the dev server
src/app.config.ts          server config: rooms, HTTP routes, Express middleware
src/rooms/                 QuizRoom and its state schema
src/game/                  question generator and scoring (pure functions)
src/shared/                rules and age groups used by both server and client
src/client/                React app; colyseus.ts holds the shared SDK client
test/                      *.test.ts, run by Vitest
```

## Deploy (free)

The game server runs on **Render** (free web service) and the page on **Vercel**. Both redeploy on every push to `main`. The settings live in the repo: [render.yaml](render.yaml) and [vercel.json](vercel.json).

1. **Render (game server).** Sign in at render.com with GitHub → **New → Blueprint** → pick this repo. Render reads `render.yaml` and asks for `ALLOWED_ORIGINS`: enter `https://quiz-battle.vercel.app` for now (you can fix it in step 3). When it's live, copy the service address, e.g. `https://quiz-battle.onrender.com`.
2. **Vercel (page).** **Add New → Project** → import this repo. Under **Environment Variables** add `VITE_SERVER_URL` = the Render address from step 1. Deploy, then copy the Vercel address.
3. **If the Vercel address isn't `https://quiz-battle.vercel.app`**, go to the Render service → **Environment** → set `ALLOWED_ORIGINS` to the real one. Render restarts with it.
4. **Check:** open the Vercel address. If the server was asleep you'll see "Waking up the game server…" for up to a minute, then Create and Join turn on.

`VITE_SERVER_URL` is baked into the page when Vercel builds it, so changing it needs a redeploy on Vercel.

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | Vercel (client) | Game server address, e.g. `https://quiz-battle.onrender.com`. Unset in dev: the client uses its own host. |
| `ALLOWED_ORIGINS` | Render (server) | Websites allowed to call the server from a browser (the Vercel address), comma-separated. localhost is always allowed. |
| `NODE_ENV=production` | Render (server) | Turns off the playground and monitor, and turns on the `ALLOWED_ORIGINS` check |
| `PORT=2567` | Render (server) | The built server listens on 2567, so Render must route there |

Render's free server sleeps after 15 minutes without players and takes about a minute to wake. Answers during a game count as traffic, so it never sleeps mid-game.
