# Plan: Quiz Battle, a browser multiplayer math quiz

## Context

You want to learn something new. Your portfolio (muhdnabil.site) already covers Laravel, MySQL, Linux servers, UE5, Unity and Godot. It is missing three things: **multiplayer**, a **JavaScript/TypeScript backend**, and **any game people can play from a link**.

Quiz Battle covers all three. It's a Kahoot-style version of your Math Quiz Arcade. Players join a room from their phones with a 4-letter code and race to answer math questions. The server makes the questions, runs the timer, and decides the scores. The finished game gets a public link you can put on your portfolio.

**Decisions made:**
- Everyone plays on their own phone. The person who makes the room is the host and presses Start.
- The server generates the math questions (no question content to write).
- **Claude sets up the project, config, UI screens and deploy.** The plan was for you to write the multiplayer game code. On 29 Sep 2026 you asked Claude to write it instead (questions, then the whole room and the client wiring), so M1–M4 are done. The code has comments explaining why each part works the way it does.
- **Hosting must be free.** Your Railway trial has ended, so the server goes on Render's free tier and the client on Vercel.
- **Project folder:** `C:\Users\akusu\OneDrive\Documents\math quiz` (npm package name `quiz-battle`).

## Stack (versions installed 29 Sep 2026)

| Part | Tool | Why |
|---|---|---|
| Game server | **Colyseus 0.18** (Node + TypeScript) | Built for game rooms: syncs state to all players, gives each room a timer (`this.clock`), handles reconnection |
| Server state | `@colyseus/schema` 5, `schema()` builder style | The style the docs recommend, and the one the generator uses (`src/rooms/schema/MyRoomState.ts` is an example). |
| Client | React 19 + Vite 8 + Tailwind 4 | Same as NadNab |
| Client ↔ server | `@colyseus/sdk` + `@colyseus/react` (`useRoom`, `useRoomState`) | Official React hooks. Components re-render when the room state changes. |
| Tests | Vitest 5 + `@colyseus/testing` | Unit tests for the rules, room tests with fake clients. (The generator shipped mocha; it was swapped for Vitest in M0.) |
| Game server hosting | **Render free web service** | Free with no card. WebSockets work. It sleeps after 15 min without traffic and takes about 1 min to wake up. Answers during a game count as traffic, so it won't sleep mid-game. 750 free hours/month is enough to run one service all month. |
| Client hosting | **Vercel** (free, you know it) | The page loads instantly even while the server is asleep, so it can show a "Waking up the game server…" screen instead of a blank wait |
| Code | git + GitHub from day 1 | Render and Vercel both redeploy by themselves on every push |

## Game rules (first version)

- A room has a **4-letter code** (e.g. `KTPQ`) and holds **2–8 players**. Nicknames are 1–12 characters and must be unique in the room.
- The first player is the host. If the host leaves, the next player becomes host.
- The host presses **Start** (needs 2+ players). The room then locks: no new players, but dropped players can still come back.
- **10 rounds.** Each round has a **question phase** (15 s) and then a **reveal phase** (4 s). A question ends early if every connected player has answered.
- **Age groups.** The host picks who's playing when creating the room: ages 7–8, 9–10 or 11–12. Everyone in the room gets the same questions for that age group.
- **Difficulty goes up** within the age group, in four steps: rounds 1–3, 4–6, 7–8 and 9–10. For example, ages 7–8 go from sums within 10 to the 2, 5 and 10 times tables; ages 11–12 go from times tables to 12 up to percentages and order of operations. The full list is in `src/game/questions.ts`.
- Each question has **4 choices**: the right answer plus 3 close wrong ones. All 4 are different, none are negative, and they're shuffled.
- **Score:** a wrong answer or no answer gets 0. A right answer gets `500 + round(500 × timeLeft / 15)`, which is 500–1000 points. The server measures the time with its own clock when your message arrives.
- Only your first answer counts.
- After round 10, a **podium** shows the top 3 and all scores. The host can press **Play again**, which goes back to the lobby and resets the scores.

## How the server stays in charge (the main thing you'll learn)

- **State** is what every player can see. It syncs to all phones automatically.
- **Messages** are what players ask for. The server checks every message and ignores anything that isn't allowed.
- **Secrets stay out of the state.** The index of the right answer and each player's chosen answer are kept in private room fields during the question phase. They go into the state only at reveal. If they were in the state earlier, anyone could read them in DevTools and cheat.
- **The server ignores a message if** it arrives in the wrong phase, has a choice that isn't a whole number 0–3, is a second answer, or is Start/Play again from someone who isn't the host. Players can't send their own score. The room also caps how many messages each player can send per second.

**State shape** (you'll write this):
```
Player:    name, score, isHost, connected, hasAnswered, lastAnswer (-1 until reveal), lastGain
QuizState: players (map by sessionId), ageGroup ("7-8" | "9-10" | "11-12"), phase ("lobby" | "question" | "reveal" | "podium"),
           round, totalRounds, questionText, choices (4 strings), timeLeft, correctIndex (-1 until reveal)
```
**Messages from client to server:** `start`, `answer { choice }`, `playAgain`. Everything else goes through the state.

## Project layout (confirmed in M0)

`create-colyseus-app --layout vite` puts client and server in one Vite project.

```
index.html                         client HTML entry
vite.config.ts                     React + Tailwind + colyseus/vite plugin
vitest.config.ts                   test config (kept apart so tests don't boot the dev server)
src/app.config.ts                  server config: register rooms, HTTP routes, Express (/health, CORS in M5)
src/rooms/QuizRoom.ts              the game: lobby, rounds, timer, answers, reveal, podium, reconnection
src/rooms/schema/QuizState.ts      Player + QuizState, the state every phone sees
src/game/questions.ts              question generator per age group
src/game/scoring.ts                points for one answer (500–1000 when right)
src/shared/rules.ts                player limits, round count, timings, points
src/shared/ageGroups.ts            the three age groups, isAgeGroup() for checking create options
src/client/main.tsx                React entry
src/client/App.tsx                 connects to the room (create, join, rejoin after refresh) and picks the screen
src/client/colyseus.ts             the shared SDK client (reads VITE_SERVER_URL)
src/client/inviteLink.ts           reads ?room=KTPQ, builds the share link
src/client/screens/                Home, Lobby, GameView (temporary: Question, Reveal and Podium come next)
src/client/ui/Button.tsx           the red/white tile button
scripts/sample-questions.ts        npm run sample-questions prints a sample game
DESIGN.md                          design direction (owner's answers) + dials
test/                              questions, scoring and QuizRoom tests (Vitest)
```

## Milestones

Each milestone ends with something you can run. Rough time: 5–7 evenings in total.

### M0: Setup (Claude) ✅ done 29 Sep 2026
1. Scaffolded with `npm create colyseus-app@latest . -- --ts --preset minimal --layout vite --name quiz-battle --yes`. Reconnection is left out on purpose, because you'll write it in M4.
2. Added React 19, `@colyseus/react`, Tailwind 4 and Vitest 5. Kept the generator's TypeScript (5.9). Removed mocha, the Colyseus Cloud pm2 file and the sample `.env` files.
3. `git init`, `.gitignore` (node_modules, dist, `.env*` except `.env.example`), first commit.
4. **Checked:** `npm run dev` serves everything on **one port, :5173** (not :2567 + :5173 as first guessed: the Vite plugin runs the server inside Vite's HTTP server). The page reaches the server, the playground at `/playground` joins `my_room`, `npm test` and `npm run typecheck` pass, `npm run build` produces both halves.

### M1: Rooms and lobby ✅ done 29 Sep 2026 (Claude, at your request)
- **Room:** the `Player` and `QuizState` schemas. In `QuizRoom`: `onCreate` (4-letter code using the docs' "custom room ID" recipe, `maxClients = 8`), `onJoin` (add the player, first one is host, check the name), `onLeave` (remove the player, pass on the host role). Register it in `src/app.config.ts`. In the client: `client.create()` and `client.joinById(code, { name })`, and read the player list with `useRoomState`.
- **Claude:** ✅ Home screen (nickname, Create, Join with code) and Lobby screen (big room code, player list with host badge, Start button only for the host). Built with sample data first (`src/client/preview/`). A share link `?room=KTPQ` fills in the code.
  - Home props: `initialCode`, `initialName`, `initialAgeGroup`, `busy`, `error`, `onCreate(name, ageGroup)`, `onJoin(code, name)`.
  - Lobby props: `code`, `ageGroup`, `players` (array of `{ sessionId, name, isHost, connected }`, undefined while loading), `mySessionId`, `minPlayers`, `maxPlayers`, `starting`, `onStart()`, `onLeave()`.
  - Your wiring: turn the state's `players` map into that array, and pass `room.roomId` as `code` and `room.sessionId` as `mySessionId`.
  - Age group: send it as a create option (`client.create("quiz_room", { name, ageGroup })`). In `QuizRoom.onCreate`, check it with `isAgeGroup()` (a client can send anything), fall back to `DEFAULT_AGE_GROUP`, and store it in the state so the Lobby can show it.
- **Worth reading in the code:** the room lifecycle, how state syncs, `sessionId`, joining a room by its ID.

### M2: Game loop ✅ server done 29 Sep 2026 (Claude, at your request)
- **Room:** the phase machine lobby → question → reveal → … → podium → lobby. The `start` handler (host only, locks the room). Questions: call `makeQuestionSet(state.ageGroup, TOTAL_ROUNDS)` when the game starts and keep the result in a private room field (it holds `correctIndex`). Each round, copy only `text` and `choices` into the state. The timer: `this.clock.setInterval` counts `timeLeft` down, and `this.clock.setTimeout` moves from reveal to the next round. Clear old timers on every phase change. The `answer` handler with all the checks above. End early when all connected players have answered. Reveal, podium, `playAgain`.
- **Claude, next:** designed Question screen (round x/10, timer bar, 2×2 grid of big answer buttons, a "Locked in, 3/5 answered" state), Reveal screen (right answer, your +points or Wrong, mini leaderboard), Podium screen. Until then `GameView.tsx` is a plain working stand-in.
- **Worth reading in the code:** authoritative servers, when to use state and when to use messages, keeping secrets from clients, timing on the server.

### M3: Scoring and tests ✅ done 29 Sep 2026 (Claude, at your request)
- `game/scoring.ts` with `test/scoring.test.ts` (0 s and 15 s left, wrong answers, odd timings).
- `test/QuizRoom.test.ts` plays a full 10-round game with 3 fake players and checks the scores. It also checks that a second answer, an answer in the lobby, a bad choice, and Start or Play again from a non-host are all ignored, that the right answer isn't visible to other players before reveal, and that dropped players can come back or get removed.

### M4: Real phones, bad networks ✅ code done 29 Sep 2026 (Claude, at your request)
- **Done:** on the server, `onDrop` → `allowReconnection(client, 30)` and `connected = false`, `onReconnect` → `connected = true`, and `onLeave` removes the player and passes on the host role. On the client, save `room.reconnectionToken` in sessionStorage so a page refresh can come back with `client.reconnect(token)`.
- **Done:** a "Reconnecting…" banner, and "no game with that code" / "already started" errors on the Home screen.
- **Still to test by hand:** play on your phone and a laptop on the same Wi-Fi (`npm run dev -- --host`). Turn one off with DevTools → Network → Offline. Refresh in the middle of a question. Lock the phone screen for 10 s.

### M5: Ship it for free (Claude sets it up, you do the account steps, ~1 evening)
- **Claude:**
  - A `/health` route. The playground and monitor are already off when `NODE_ENV=production`.
  - CORS on the server so it only accepts the Vercel domain and localhost.
  - The client reads the server address from `VITE_SERVER_URL` (already wired in `src/client/colyseus.ts`; unset in dev it uses the page's own host).
  - A "Waking up the game server (up to a minute)…" screen that checks `/health` and turns on Create/Join once the server answers.
  - A `render.yaml` in the repo with the settings below.
- **You, on Render:** New → Web Service → connect the GitHub repo → Free instance.
  - Build: `npm ci --include=dev && npm run build` (`--include=dev` because Vite is a dev dependency and `NODE_ENV=production` would otherwise skip it)
  - Start: `node dist/server/server.mjs`
  - Env: `NODE_ENV=production`, `PORT=2567` (the generated server entry listens on 2567)
- **You, on Vercel:** import the same repo. Root directory: `./`. Build command: `npm run build:client`. Output directory: `dist/client`. Env: `VITE_SERVER_URL=wss://<your-service>.onrender.com`.
- **Optional:** point `quiz.muhdnabil.site` at Vercel (a DNS change you make yourself), then add the game to your portfolio with a **Play now** link.
- **If you want it always on later (still free):**
  - Oracle Cloud "Always Free" VM, set up with your Ubuntu/UFW skills. Needs a card to verify your identity, but doesn't charge it.
  - Azure for Students: $100 credit a year with your UTeM email and no card.
  - Neither is needed now.

### Later (pick one after launch)
Kahoot-style big-screen mode · answer-streak bonus · sounds · animated leaderboard (`motion`) · load test with 50 bots (`@colyseus/loadtest`) · a public list of open rooms.

## How we check each part works

- **Server first, before the UI exists:** use the Colyseus playground (`/playground`) to join rooms and send `start`/`answer` by hand. That includes trying to cheat (answer twice, answer in the lobby, Start as a non-host) and checking that the server ignores it.
- **Unit and room tests:** `npm test` must pass before each commit from M3 on.
- **In the browser:** 3 browser tabs, one full 10-round game. Check that the timer, early end, reveal and podium all work. In DevTools, look at the state during a question: it must not contain the right answer.
- **After deploy:** first open the Vercel URL after the server has slept 15+ min, and check the waking-up screen appears and then clears. Then two phones on mobile data (not the same Wi-Fi) play one full game.
- The UI follows the same antislop rules as NadNab: readable contrast, tap targets of 44px or more, and it works at 360px wide.

## Waiting on you
1. An empty GitHub repo, then push (commands in the M0 hand-off).
2. A free Render account, signed in with GitHub (in M5). You already have Vercel.

Until M5, everything runs on your own PC and costs nothing.
