import { useEffect, useRef } from "react";
import type { Phase } from "../shared/rules";

// The shape of the room state as the screens read it (a plain snapshot from useRoomState).

export interface PlayerView {
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  hasAnswered: boolean;
  lastAnswer: number;
  lastGain: number;
}

export interface GameSnapshot {
  phase: Phase;
  round: number;
  totalRounds: number;
  questionText: string;
  choices: readonly string[];
  timeLeft: number;
  correctIndex: number;
  players: Readonly<Record<string, PlayerView>>;
}

export interface RankedPlayer extends PlayerView {
  sessionId: string;
  /** Equal scores share a rank: 1, 1, 3. */
  rank: number;
}

export function rankPlayers(players: GameSnapshot["players"]): RankedPlayer[] {
  const list = Object.entries(players).map(([sessionId, p]) => ({ sessionId, ...p }));
  return list
    .map((p) => ({ ...p, rank: 1 + list.filter((q) => q.score > p.score).length }))
    .sort((a, b) => a.rank - b.rank);
}

export function isTied(ranked: RankedPlayer[], rank: number) {
  return ranked.filter((p) => p.rank === rank).length > 1;
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
export const ordinal = (n: number) => ORDINALS[n - 1] ?? `${n}th`;

export const formatScore = (n: number) => n.toLocaleString("en-US");

/**
 * Moves focus to the element when a screen appears, so keyboard and screen
 * reader users start from the new question or result instead of a stale button.
 * The target is a heading (tabIndex -1, not in the tab order), so it gets no
 * focus ring: nothing there can be pressed. Buttons keep theirs.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return ref;
}
