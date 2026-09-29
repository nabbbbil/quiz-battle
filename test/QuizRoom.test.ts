import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";
import type { QuizRoom } from "../src/rooms/QuizRoom.js";
import { TOTAL_ROUNDS } from "../src/shared/rules.js";

let colyseus: ColyseusTestServer<typeof appConfig>;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

/** Waits until `check()` is true, polling every 10 ms. */
async function until(check: () => boolean, timeoutMs = 3000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** A room with the given players connected in order (the first is host), and short timers. */
async function roomWith(names: string[], options: { ageGroup?: string } = {}) {
  const room = (await colyseus.createRoom("quiz_room", { name: names[0], ...options })) as QuizRoom;
  room.questionMs = 600;
  // Long enough that a 10 ms poll can't miss the reveal phase.
  room.revealMs = 200;
  const clients = [];
  for (const name of names) clients.push(await colyseus.connectTo(room, { name }));
  await until(() => room.state.players.size === names.length);
  return { room, clients };
}

/** The server's secret right answer for the current round. */
const rightAnswer = (room: QuizRoom) => room["questions"][room.state.round - 1].correctIndex;

describe("creating a room", () => {
  it("gets a 4-letter code with no I or O", async () => {
    const { room } = await roomWith(["Aina"]);
    expect(room.roomId).toMatch(/^[A-HJ-NP-Z]{4}$/);
  });

  it("keeps a valid age group and ignores a made-up one", async () => {
    const { room: young } = await roomWith(["Aina"], { ageGroup: "7-8" });
    expect(young.state.ageGroup).toBe("7-8");
    const { room: bogus } = await roomWith(["Aina"], { ageGroup: "99-100" });
    expect(bogus.state.ageGroup).toBe("9-10");
  });
});

describe("joining", () => {
  it("makes the first player host", async () => {
    const { room, clients: [host, guest] } = await roomWith(["Aina", "Ben"]);
    expect(room.state.players.get(host.sessionId)!.isHost).toBe(true);
    expect(room.state.players.get(guest.sessionId)!.isHost).toBe(false);
  });

  it("refuses empty, too long and duplicate nicknames with a readable reason", async () => {
    const { room } = await roomWith(["Aina"]);
    await expect(colyseus.sdk.joinById(room.roomId, { name: "   " })).rejects.toThrow("Type a nickname first.");
    await expect(colyseus.sdk.joinById(room.roomId, { name: "ThirteenChars" })).rejects.toThrow("up to 12 characters");
    await expect(colyseus.sdk.joinById(room.roomId, { name: "aina" })).rejects.toThrow("already called aina");
    expect(room.state.players.size).toBe(1);
  });

  it("passes host to the next player when the host leaves", async () => {
    const { room, clients: [host, second] } = await roomWith(["Aina", "Ben", "Chen"]);
    await host.leave();
    await until(() => room.state.players.size === 2);
    expect(room.state.players.get(second.sessionId)!.isHost).toBe(true);
  });
});

describe("starting", () => {
  it("ignores Start from a non-host and with fewer than 2 players", async () => {
    const solo = await roomWith(["Aina"]);
    solo.clients[0].send("start");
    await new Promise((r) => setTimeout(r, 100));
    expect(solo.room.state.phase).toBe("lobby");

    const { room, clients: [, guest] } = await roomWith(["Aina", "Ben"]);
    guest.send("start");
    await new Promise((r) => setTimeout(r, 100));
    expect(room.state.phase).toBe("lobby");
  });

  it("starts round 1 and locks the room to new players", async () => {
    const { room, clients: [host] } = await roomWith(["Aina", "Ben"]);
    host.send("start");
    await until(() => room.state.phase === "question");
    expect(room.state.round).toBe(1);
    expect(room.state.choices.length).toBe(4);
    await expect(colyseus.sdk.joinById(room.roomId, { name: "Late" })).rejects.toThrow("locked");
  });
});

describe("answering", () => {
  it("ignores answers in the lobby", async () => {
    const { room, clients: [, guest] } = await roomWith(["Aina", "Ben"]);
    guest.send("answer", { choice: 0 });
    await new Promise((r) => setTimeout(r, 100));
    expect(room["answers"].size).toBe(0);
  });

  it("ignores choices that aren't a whole number from 0 to 3", async () => {
    const { room, clients: [host, guest] } = await roomWith(["Aina", "Ben"]);
    room.questionMs = 10_000;
    host.send("start");
    await until(() => room.state.phase === "question");

    for (const choice of [4, -1, 1.5, "2", null]) guest.send("answer", { choice } as never);
    await new Promise((r) => setTimeout(r, 100));
    expect(room.state.players.get(guest.sessionId)!.hasAnswered).toBe(false);
  });

  it("counts only the first answer", async () => {
    const { room, clients: [host, guest] } = await roomWith(["Aina", "Ben", "Chen"]);
    room.questionMs = 10_000;
    host.send("start");
    await until(() => room.state.phase === "question");

    guest.send("answer", { choice: 1 });
    guest.send("answer", { choice: 2 });
    await until(() => room.state.players.get(guest.sessionId)!.hasAnswered);
    await new Promise((r) => setTimeout(r, 100));
    expect(room["answers"].get(guest.sessionId)!.choice).toBe(1);
  });

  it("keeps the right answer and everyone's picks out of the synced state until reveal", async () => {
    const { room, clients: [host, guest] } = await roomWith(["Aina", "Ben", "Chen"]);
    room.questionMs = 10_000;
    host.send("start");
    await until(() => room.state.phase === "question");

    host.send("answer", { choice: rightAnswer(room) });
    // What another player's phone (and its DevTools) can see:
    await until(() => guest.state.players.get(host.sessionId)?.hasAnswered === true);
    expect(guest.state.correctIndex).toBe(-1);
    expect(guest.state.players.get(host.sessionId)!.lastAnswer).toBe(-1);
    expect(guest.state.players.get(host.sessionId)!.score).toBe(0);
  });

  it("reveals early once every connected player has answered", async () => {
    const { room, clients } = await roomWith(["Aina", "Ben"]);
    room.questionMs = 10_000;
    clients[0].send("start");
    await until(() => room.state.phase === "question");

    room.revealMs = 10_000;
    for (const c of clients) c.send("answer", { choice: 0 });
    await until(() => room.state.phase === "reveal", 1000);
    expect(room.state.correctIndex).toBe(rightAnswer(room));
  });
});

describe("a full game", () => {
  it("plays 10 rounds, scores right, wrong and missing answers, then goes back to the lobby", async () => {
    const { room, clients: [host, wrong, silent] } = await roomWith(["Aina", "Ben", "Chen"], { ageGroup: "11-12" });
    host.send("start");

    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      await until(() => room.state.phase === "question" && room.state.round === round);
      const right = rightAnswer(room);
      host.send("answer", { choice: right });
      wrong.send("answer", { choice: (right + 1) % 4 });
      // `silent` never answers, so each round ends on the timer.
      await until(() => room.state.phase === "reveal" && room.state.round === round);
      expect(room.state.players.get(host.sessionId)!.lastAnswer).toBe(right);
    }
    await until(() => room.state.phase === "podium");

    const score = (c: { sessionId: string }) => room.state.players.get(c.sessionId)!.score;
    expect(score(host)).toBeGreaterThanOrEqual(500 * TOTAL_ROUNDS);
    expect(score(host)).toBeLessThanOrEqual(1000 * TOTAL_ROUNDS);
    expect(score(wrong)).toBe(0);
    expect(score(silent)).toBe(0);

    // Only the host can restart.
    wrong.send("playAgain");
    await new Promise((r) => setTimeout(r, 100));
    expect(room.state.phase).toBe("podium");

    host.send("playAgain");
    await until(() => room.state.phase === "lobby");
    expect(score(host)).toBe(0);
    expect(room.state.round).toBe(0);
    // Unlocked again, so a new friend can join the next game.
    const late = await colyseus.sdk.joinById(room.roomId, { name: "Dina" });
    await until(() => room.state.players.size === 4);
    await late.leave();
  }, 30_000);
});

describe("dropped connections", () => {
  it("marks a dropped player offline and lets them back in with their score", async () => {
    const { room, clients: [, guest] } = await roomWith(["Aina", "Ben"]);
    room.state.players.get(guest.sessionId)!.score = 1234;
    guest.reconnection.enabled = false;
    const { sessionId, reconnectionToken } = guest;

    guest.connection.close(3000, "phone went to sleep");
    await until(() => room.state.players.get(sessionId)?.connected === false);

    const back = await colyseus.sdk.reconnect(reconnectionToken);
    expect(back.sessionId).toBe(sessionId);
    await until(() => room.state.players.get(sessionId)?.connected === true);
    expect(room.state.players.get(sessionId)!.score).toBe(1234);
  });

  it("doesn't wait for a dropped player's answer", async () => {
    const { room, clients: [host, answerer, dropper] } = await roomWith(["Aina", "Ben", "Chen"]);
    room.questionMs = 10_000;
    host.send("start");
    await until(() => room.state.phase === "question");

    dropper.reconnection.enabled = false;
    dropper.connection.close(3000);
    await until(() => room.state.players.get(dropper.sessionId)?.connected === false);

    room.revealMs = 10_000;
    host.send("answer", { choice: 0 });
    answerer.send("answer", { choice: 0 });
    await until(() => room.state.phase === "reveal", 1000);
  });

  it("removes a player who doesn't come back in time, and passes on host", async () => {
    const { room, clients: [host, guest] } = await roomWith(["Aina", "Ben"]);
    room.reconnectSeconds = 0.2;
    host.reconnection.enabled = false;
    host.connection.close(3000);

    await until(() => room.state.players.size === 1);
    expect(room.state.players.get(guest.sessionId)!.isHost).toBe(true);
  });
});
