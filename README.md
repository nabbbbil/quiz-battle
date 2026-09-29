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

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | Vercel (client) | Game server address, e.g. `wss://quiz-battle.onrender.com`. Unset in dev: the client uses its own host. |
| `NODE_ENV=production` | Render (server) | Turns off the playground and monitor |
| `PORT=2567` | Render (server) | The built server listens on 2567, so Render must route there |
