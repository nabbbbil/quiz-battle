import { schema, t, type SchemaType } from "@colyseus/schema";
import { DEFAULT_AGE_GROUP, type AgeGroup } from "../../shared/ageGroups";
import { TOTAL_ROUNDS, type Phase } from "../../shared/rules";

// Everything in here is sent to every phone. Anything a player could cheat
// with (the right answer, other players' picks) stays out until the reveal.

export const Player = schema({
  name: t.string(),
  score: t.uint32().default(0),
  isHost: t.boolean().default(false),
  /** False while the player's connection is lost and their seat is held. */
  connected: t.boolean().default(true),
  /** Public so everyone sees "3 of 5 answered". Which choice stays secret. */
  hasAnswered: t.boolean().default(false),
  /** The choice they picked, filled in at reveal. -1 until then, or if they didn't answer. */
  lastAnswer: t.int8().default(-1),
  /** Points won last round, filled in at reveal. */
  lastGain: t.uint16().default(0),
});
export type Player = SchemaType<typeof Player>;

export const QuizState = schema({
  /** Keyed by sessionId, in the order players joined. */
  players: t.map(Player),
  ageGroup: t.string<AgeGroup>().default(DEFAULT_AGE_GROUP),
  phase: t.string<Phase>().default("lobby"),
  /** 1-based during a game, 0 in the lobby. */
  round: t.uint8().default(0),
  totalRounds: t.uint8().default(TOTAL_ROUNDS),
  questionText: t.string().default(""),
  choices: t.array("string"),
  /** Whole seconds left in the question phase. */
  timeLeft: t.uint8().default(0),
  /** Index of the right choice, -1 until reveal. */
  correctIndex: t.int8().default(-1),
});
export type QuizState = SchemaType<typeof QuizState>;
