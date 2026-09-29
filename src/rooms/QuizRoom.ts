import { Room, ServerError, ErrorCode, type Client, type Delayed } from "colyseus";
import { ArraySchema } from "@colyseus/schema";
import { Player, QuizState } from "./schema/QuizState";
import { makeQuestionSet, type Question } from "../game/questions";
import { scoreAnswer } from "../game/scoring";
import { DEFAULT_AGE_GROUP, isAgeGroup, type AgeGroup } from "../shared/ageGroups";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  NAME_MAX_LENGTH,
  QUESTION_SECONDS,
  RECONNECT_SECONDS,
  REVEAL_SECONDS,
  ROOM_CODE_LENGTH,
  TOTAL_ROUNDS,
} from "../shared/rules";

/** What the client sends to create or join. Typed for the SDK, but checked here anyway. */
export interface JoinOptions {
  name: string;
  /** Only read when creating a room. */
  ageGroup?: AgeGroup;
}

// No I or O: they're easy to confuse with 1 and 0 when read off a screen.
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
// Presence set of codes in use, shared by every room on this server.
const ROOM_CODES_KEY = "quiz_room:codes";

/** Refuse a join with a message the Home screen can show as-is. */
function refuse(message: string): never {
  throw new ServerError(ErrorCode.APPLICATION_ERROR, message);
}

export class QuizRoom extends Room<{ state: QuizState }> {
  maxClients = MAX_PLAYERS;
  // A kid mashing buttons stays well under this. A script flooding the room gets cut off.
  maxMessagesPerSecond = 20;
  state = new QuizState();

  /** Timings. Tests shorten these so a 10-round game runs in seconds. */
  questionMs = QUESTION_SECONDS * 1000;
  revealMs = REVEAL_SECONDS * 1000;
  reconnectSeconds = RECONNECT_SECONDS;

  // Server-only. None of this is in the state, so no player can read it early.
  private questions: Question[] = [];
  private answers = new Map<string, { choice: number; points: number }>();
  private questionEndsAt = 0;
  private timers: Delayed[] = [];

  messages = {
    start: (client: Client) => {
      if (this.state.phase !== "lobby" || !this.isHost(client)) return;
      if (this.state.players.size < MIN_PLAYERS) return;

      // Locking stops new players joining. Dropped players can still reconnect.
      this.lock();
      this.questions = makeQuestionSet(this.state.ageGroup, TOTAL_ROUNDS);
      this.state.totalRounds = TOTAL_ROUNDS;
      this.state.round = 0;
      this.startQuestion();
    },

    answer: (client: Client, message: { choice: number }) => {
      if (this.state.phase !== "question") return;
      const player = this.state.players.get(client.sessionId);
      if (!player || this.answers.has(client.sessionId)) return; // only the first answer counts

      const choice = message?.choice;
      if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;

      // Timed with the server's clock on arrival, so a client can't claim it was fast.
      const msLeft = this.questionEndsAt - Date.now();
      if (msLeft <= 0) return; // arrived after the buzzer, before the timer fired

      const correct = choice === this.questions[this.state.round - 1].correctIndex;
      this.answers.set(client.sessionId, { choice, points: scoreAnswer(correct, msLeft, this.questionMs) });
      player.hasAnswered = true;

      if (this.everyoneAnswered()) this.reveal();
    },

    playAgain: (client: Client) => {
      if (this.state.phase !== "podium" || !this.isHost(client)) return;
      this.backToLobby();
    },
  };

  async onCreate(options: JoinOptions) {
    this.roomId = await this.claimRoomCode();
    this.state.ageGroup = isAgeGroup(options?.ageGroup) ? options.ageGroup : DEFAULT_AGE_GROUP;
  }

  onJoin(client: Client, options: JoinOptions) {
    const name = typeof options?.name === "string" ? options.name.trim() : "";
    if (name.length === 0) refuse("Type a nickname first.");
    if (name.length > NAME_MAX_LENGTH) refuse(`Nicknames can be up to ${NAME_MAX_LENGTH} characters.`);

    const taken = [...this.state.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (taken) refuse(`Someone in this room is already called ${name}. Pick another nickname.`);

    // The first player in is the host.
    const isHost = this.state.players.size === 0;
    this.state.players.set(client.sessionId, new Player({ name, isHost }));
  }

  onDrop(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // Keep their seat, score and host role for a while. If they don't come
    // back in time, Colyseus calls onLeave.
    player.connected = false;
    this.allowReconnection(client, this.reconnectSeconds);

    // Don't make everyone wait for someone whose phone just died.
    if (this.state.phase === "question" && this.everyoneAnswered()) this.reveal();
  }

  onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    this.state.players.delete(client.sessionId);
    this.answers.delete(client.sessionId);

    // Hand the host role to whoever joined next.
    if (player.isHost) {
      const next = this.state.players.values().next().value;
      if (next) next.isHost = true;
    }

    if (this.state.phase === "question" && this.everyoneAnswered()) this.reveal();
  }

  async onDispose() {
    this.clearTimers();
    await this.presence.srem(ROOM_CODES_KEY, this.roomId);
  }

  // ---- Phases ------------------------------------------------------------

  private startQuestion() {
    this.clearTimers();
    this.state.round += 1;
    const question = this.questions[this.state.round - 1];

    this.answers.clear();
    for (const player of this.state.players.values()) {
      player.hasAnswered = false;
      player.lastAnswer = -1;
      player.lastGain = 0;
    }

    // Only the text and choices go into the state. correctIndex stays on the server.
    this.state.questionText = question.text;
    this.state.choices = new ArraySchema(...question.choices);
    this.state.correctIndex = -1;
    this.state.phase = "question";

    this.questionEndsAt = Date.now() + this.questionMs;
    this.state.timeLeft = Math.ceil(this.questionMs / 1000);
    this.timers.push(
      this.clock.setInterval(() => {
        this.state.timeLeft = Math.max(0, Math.ceil((this.questionEndsAt - Date.now()) / 1000));
      }, 250),
      this.clock.setTimeout(() => this.reveal(), this.questionMs),
    );
  }

  private reveal() {
    if (this.state.phase !== "question") return;
    this.clearTimers();

    for (const [sessionId, player] of this.state.players) {
      const answer = this.answers.get(sessionId);
      player.lastAnswer = answer ? answer.choice : -1;
      player.lastGain = answer ? answer.points : 0;
      player.score += player.lastGain;
    }
    this.state.correctIndex = this.questions[this.state.round - 1].correctIndex;
    this.state.timeLeft = 0;
    this.state.phase = "reveal";

    this.timers.push(
      this.clock.setTimeout(() => {
        if (this.state.round >= this.state.totalRounds) this.state.phase = "podium";
        else this.startQuestion();
      }, this.revealMs),
    );
  }

  private backToLobby() {
    this.clearTimers();
    for (const player of this.state.players.values()) {
      player.score = 0;
      player.hasAnswered = false;
      player.lastAnswer = -1;
      player.lastGain = 0;
    }
    this.state.round = 0;
    this.state.questionText = "";
    this.state.choices = new ArraySchema<string>();
    this.state.correctIndex = -1;
    this.state.timeLeft = 0;
    this.state.phase = "lobby";
    this.questions = [];
    this.answers.clear();
    // New friends can join again (up to maxClients, which Colyseus still enforces).
    this.unlock();
  }

  // ---- Helpers -----------------------------------------------------------

  private isHost(client: Client) {
    return this.state.players.get(client.sessionId)?.isHost === true;
  }

  /** True when every connected player has answered. Dropped players don't hold up the round. */
  private everyoneAnswered() {
    let connected = 0;
    for (const [sessionId, player] of this.state.players) {
      if (!player.connected) continue;
      connected++;
      if (!this.answers.has(sessionId)) return false;
    }
    return connected > 0;
  }

  private clearTimers() {
    for (const timer of this.timers) timer.clear();
    this.timers = [];
  }

  /** A random 4-letter code that no other room is using. It becomes the room's ID. */
  private async claimRoomCode(): Promise<string> {
    const inUse = new Set(await this.presence.smembers(ROOM_CODES_KEY));
    let code: string;
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
    } while (inUse.has(code));
    // Two rooms created in the same instant could still pick the same code.
    // With 331,776 codes that's very unlikely for a game this size.
    await this.presence.sadd(ROOM_CODES_KEY, code);
    return code;
  }
}
