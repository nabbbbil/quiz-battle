import { describe, it, expect } from "vitest";
import { makeQuestion, makeQuestionSet, tierForRound, type Rng } from "../src/game/questions.js";
import { AGE_GROUPS } from "../src/shared/ageGroups.js";

// Seeded RNG so a failing case can be replayed (mulberry32).
function seeded(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Works the answer out from the text alone, so the test doesn't trust the
// generator's own arithmetic.
function solve(text: string): number {
  const missing = text.match(/^(\?|\d+) \+ (\?|\d+) = (\d+)$/);
  if (missing) {
    const known = Number(missing[1] === "?" ? missing[2] : missing[1]);
    return Number(missing[3]) - known;
  }
  const [left, right] = text.split(" = ");
  expect(right).toBe("?");

  const fraction = left.match(/^(Half|A third|A quarter|Three quarters) of (\d+)$/);
  if (fraction) {
    const share = { Half: 1 / 2, "A third": 1 / 3, "A quarter": 1 / 4, "Three quarters": 3 / 4 }[fraction[1]]!;
    return Number(fraction[2]) * share;
  }
  const percent = left.match(/^(\d+)% of (\d+)$/);
  if (percent) return (Number(percent[1]) * Number(percent[2])) / 100;

  // Plain arithmetic: × and ÷ first, then + and − left to right.
  const tokens = left.split(" ");
  const terms: (number | string)[] = [Number(tokens[0])];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = Number(tokens[i + 1]);
    if (op === "×" || op === "÷") {
      const prev = terms.pop() as number;
      terms.push(op === "×" ? prev * n : prev / n);
    } else {
      terms.push(op, n);
    }
  }
  let total = terms[0] as number;
  for (let i = 1; i < terms.length; i += 2) {
    total = terms[i] === "+" ? total + (terms[i + 1] as number) : total - (terms[i + 1] as number);
  }
  return total;
}

const TOTAL_ROUNDS = 10;
const SEEDS = 300;

describe("makeQuestion", () => {
  for (const { id } of AGE_GROUPS) {
    it(`ages ${id}: right answer is a choice, 4 different whole numbers, none negative`, () => {
      for (let seed = 0; seed < SEEDS; seed++) {
        const rng = seeded(seed);
        for (let round = 1; round <= TOTAL_ROUNDS; round++) {
          const q = makeQuestion(id, round, TOTAL_ROUNDS, rng);
          const where = `seed ${seed}, round ${round}: ${q.text} [${q.choices}]`;
          const answer = solve(q.text);

          expect(Number.isInteger(answer) && answer >= 0, where).toBe(true);
          expect(q.choices, where).toHaveLength(4);
          expect(new Set(q.choices).size, where).toBe(4);
          for (const c of q.choices) expect(c, where).toMatch(/^\d+$/);
          expect(q.choices[q.correctIndex], where).toBe(String(answer));
        }
      }
    });
  }

  it("ages 7-8 never asks about a number above 100", () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const rng = seeded(seed);
      for (let round = 1; round <= TOTAL_ROUNDS; round++) {
        const q = makeQuestion("7-8", round, TOTAL_ROUNDS, rng);
        const numbers = [...q.text.matchAll(/\d+/g)].map((m) => Number(m[0]));
        expect(Math.max(...numbers, solve(q.text)), q.text).toBeLessThanOrEqual(100);
      }
    }
  });

  it("puts the right answer in every position, not always the same one", () => {
    const rng = seeded(1);
    const positions = new Set<number>();
    for (let i = 0; i < 100; i++) positions.add(makeQuestion("9-10", 1, TOTAL_ROUNDS, rng).correctIndex);
    expect([...positions].sort()).toEqual([0, 1, 2, 3]);
  });

  it("gives the same questions for the same seed", () => {
    expect(makeQuestionSet("11-12", TOTAL_ROUNDS, seeded(42))).toEqual(makeQuestionSet("11-12", TOTAL_ROUNDS, seeded(42)));
  });
});

describe("makeQuestionSet", () => {
  it("has one question per round and repeats none", () => {
    for (const { id } of AGE_GROUPS) {
      for (let seed = 0; seed < 100; seed++) {
        const set = makeQuestionSet(id, TOTAL_ROUNDS, seeded(seed));
        expect(set).toHaveLength(TOTAL_ROUNDS);
        expect(new Set(set.map((q) => q.text)).size, `ages ${id}, seed ${seed}`).toBe(TOTAL_ROUNDS);
      }
    }
  });
});

describe("tierForRound", () => {
  it("follows the plan for 10 rounds: 1–3, 4–6, 7–8, 9–10", () => {
    const tiers = Array.from({ length: 10 }, (_, i) => tierForRound(i + 1, 10));
    expect(tiers).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 3, 3]);
  });

  it("still ends on the hardest tier for shorter games", () => {
    expect(tierForRound(1, 5)).toBe(0);
    expect(tierForRound(5, 5)).toBe(3);
  });
});
