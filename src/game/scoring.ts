import { MAX_POINTS, MIN_POINTS } from "../shared/rules";

/**
 * Points for one answer. Wrong or missing answers get 0. A right answer gets
 * 500, plus up to 500 more the faster it came: 1000 at the very start, 500 at
 * the buzzer. `msLeft` is measured by the server when the answer arrives.
 */
export function scoreAnswer(correct: boolean, msLeft: number, questionMs: number): number {
  if (!correct) return 0;
  const fractionLeft = Math.min(1, Math.max(0, msLeft / questionMs));
  return MIN_POINTS + Math.round((MAX_POINTS - MIN_POINTS) * fractionLeft);
}
