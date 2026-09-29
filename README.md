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

**Live:** play at **https://quiz-battle-pi.vercel.app**.

| Part | Where | Settings |
|---|---|---|
| Page | Vercel project `quiz-battle` (team `muhammadnabil`) | `VITE_SERVER_URL=https://quiz-battle-r2kv.onrender.com` |
| Game server | Render service `quiz-battle` (Blueprint, free, Singapore) at https://quiz-battle-r2kv.onrender.com | `ALLOWED_ORIGINS=https://quiz-battle-pi.vercel.app` |

To set it up from scratch: create the Render service with **New → Blueprint** (it reads `render.yaml` and asks for `ALLOWED_ORIGINS`), import the repo on Vercel with `VITE_SERVER_URL` set to the Render address, and make sure each side names the other's address. If you add a custom domain for the page (like `quiz.muhdnabil.site`), add it to `ALLOWED_ORIGINS` on Render, comma-separated. If the server was asleep you'll see "Waking up the game server…" for up to a minute, then Create and Join turn on.

`VITE_SERVER_URL` is baked into the page when Vercel builds it, so changing it needs a redeploy on Vercel.

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | Vercel (client) | Game server address, e.g. `https://quiz-battle-r2kv.onrender.com`. Unset in dev: the client uses its own host. |
| `ALLOWED_ORIGINS` | Render (server) | Websites allowed to call the server from a browser (the Vercel address), comma-separated. localhost is always allowed. |
| `NODE_ENV=production` | Render (server) | Turns off the playground and monitor, and turns on the `ALLOWED_ORIGINS` check |
| `PORT=2567` | Render (server) | The built server listens on 2567, so Render must route there |

Render's free server sleeps after 15 minutes without players and takes about a minute to wake. Answers during a game count as traffic, so it never sleeps mid-game.
