// Game rules shared by the server (which enforces them) and the client (which
// uses them for hints and early checks). The server never trusts the client's copy.

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const NAME_MAX_LENGTH = 12;
export const ROOM_CODE_LENGTH = 4;

export const TOTAL_ROUNDS = 10;
export const QUESTION_SECONDS = 15;
export const REVEAL_SECONDS = 4;

/** How long a dropped player's seat is kept for them. */
export const RECONNECT_SECONDS = 30;

export const MIN_POINTS = 500;
export const MAX_POINTS = 1000;

export type Phase = "lobby" | "question" | "reveal" | "podium";
