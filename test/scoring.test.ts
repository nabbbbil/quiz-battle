import { describe, it, expect } from "vitest";
import { scoreAnswer } from "../src/game/scoring.js";

const QUESTION_MS = 15_000;

describe("scoreAnswer", () => {
  it("gives 0 for a wrong answer, however fast", () => {
    expect(scoreAnswer(false, QUESTION_MS, QUESTION_MS)).toBe(0);
    expect(scoreAnswer(false, 1, QUESTION_MS)).toBe(0);
  });

  it("gives 1000 with the full 15 s left and 500 at 0 s", () => {
    expect(scoreAnswer(true, QUESTION_MS, QUESTION_MS)).toBe(1000);
    expect(scoreAnswer(true, 0, QUESTION_MS)).toBe(500);
  });

  it("scales in between: 7.5 s left is 750", () => {
    expect(scoreAnswer(true, 7_500, QUESTION_MS)).toBe(750);
  });

  it("never goes outside 500–1000, even with odd timings", () => {
    expect(scoreAnswer(true, -200, QUESTION_MS)).toBe(500);
    expect(scoreAnswer(true, QUESTION_MS + 5_000, QUESTION_MS)).toBe(1000);
  });
});
