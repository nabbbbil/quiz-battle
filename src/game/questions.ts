import type { AgeGroup } from "../shared/ageGroups";

/** Returns a number in [0, 1). Math.random by default; tests pass a seeded one. */
export type Rng = () => number;

export interface Question {
  /** What players see, e.g. "7 × 8 = ?". Always has exactly one "?". */
  text: string;
  /** Four different whole numbers (as strings), shuffled. None are negative. */
  choices: string[];
  /** Index of the right answer in `choices`. Keep it out of the synced state until reveal. */
  correctIndex: number;
}

interface Problem {
  text: string;
  answer: number;
  /** Wrong answers a kid could plausibly pick, like a neighbouring times-table fact. */
  near: number[];
}

type Maker = (rng: Rng) => Problem;
type Range = readonly [min: number, max: number];

const int = (rng: Rng, [min, max]: Range) => min + Math.floor(rng() * (max - min + 1));
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const TABLES_2_TO_10 = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const TABLES_2_TO_12 = [...TABLES_2_TO_10, 11, 12];

// ---- Question kinds ------------------------------------------------------

function add(a: Range, b: Range, maxSum = Infinity): Maker {
  return (rng) => {
    let x: number, y: number;
    do {
      x = int(rng, a);
      y = int(rng, b);
    } while (x + y > maxSum);
    const s = x + y;
    // ±10 is the forgot-to-carry slip.
    return { text: `${x} + ${y} = ?`, answer: s, near: [s + 1, s - 1, s + 2, s + 10, s - 10] };
  };
}

function sub(a: Range, b: Range): Maker {
  return (rng) => {
    const x = int(rng, a);
    const y = int(rng, [b[0], Math.min(b[1], x)]);
    const d = x - y;
    // x + y is the added-instead-of-subtracted mistake.
    return { text: `${x} − ${y} = ?`, answer: d, near: [d + 1, d - 1, d + 2, d + 10, d - 10, x + y] };
  };
}

function times(tables: readonly number[], b: Range): Maker {
  return (rng) => {
    const t = pick(rng, tables);
    const n = int(rng, b);
    const p = t * n;
    const [x, y] = rng() < 0.5 ? [t, n] : [n, t];
    // Neighbouring facts in the same table are the classic slip.
    return { text: `${x} × ${y} = ?`, answer: p, near: [t * (n + 1), t * (n - 1), (t + 1) * n, (t - 1) * n, p + 10] };
  };
}

function multiply(a: Range, b: Range): Maker {
  return (rng) => {
    const x = int(rng, a);
    const y = int(rng, b);
    const p = x * y;
    const tens = x - (x % 10);
    // tens × y + ones: multiplied the tens but only added the ones.
    return { text: `${x} × ${y} = ?`, answer: p, near: [p + 10, p - 10, x * (y + 1), x * (y - 1), tens * y + (x % 10), p + 1] };
  };
}

function divide(divisors: readonly number[], quotient: Range): Maker {
  return (rng) => {
    const d = pick(rng, divisors);
    const q = int(rng, quotient);
    return { text: `${d * q} ÷ ${d} = ?`, answer: q, near: [q + 1, q - 1, q + 2, q - 2, q + 10] };
  };
}

function missingNumber(a: Range, b: Range): Maker {
  return (rng) => {
    const x = int(rng, a);
    const y = int(rng, b);
    const total = x + y;
    const hideFirst = rng() < 0.5;
    const hidden = hideFirst ? x : y;
    const shown = hideFirst ? y : x;
    const text = hideFirst ? `? + ${y} = ${total}` : `${x} + ? = ${total}`;
    // total + shown: added the two numbers instead of finding the gap.
    return { text, answer: hidden, near: [hidden + 1, hidden - 1, hidden + 10, hidden - 10, total + shown] };
  };
}

function twoStep(tables: readonly number[], b: Range, c: Range): Maker {
  return (rng) => {
    const x = pick(rng, tables);
    const y = int(rng, b);
    const z = int(rng, c);
    const p = x * y;
    if (rng() < 0.5 || z > p) {
      const ans = p + z;
      // x × (y + z): did the adding first. p: stopped after one step.
      return { text: `${x} × ${y} + ${z} = ?`, answer: ans, near: [x * (y + z), p, ans + 1, ans - 1, ans + 10] };
    }
    const ans = p - z;
    return { text: `${x} × ${y} − ${z} = ?`, answer: ans, near: [x * (y - z), p, ans + 1, ans - 1, ans - 10] };
  };
}

function orderOfOperations(a: Range, b: Range, c: Range): Maker {
  return (rng) => {
    const x = int(rng, a);
    const y = int(rng, b);
    const z = int(rng, c);
    const ans = x + y * z;
    // (x + y) × z: worked left to right.
    return { text: `${x} + ${y} × ${z} = ?`, answer: ans, near: [(x + y) * z, ans + 1, ans - 1, ans + 10, ans - 10] };
  };
}

const FRACTIONS = [
  { words: "Half", top: 1, bottom: 2 },
  { words: "A third", top: 1, bottom: 3 },
  { words: "A quarter", top: 1, bottom: 4 },
  { words: "Three quarters", top: 3, bottom: 4 },
] as const;

function fractionOf(multiplier: Range): Maker {
  return (rng) => {
    const f = pick(rng, FRACTIONS);
    const whole = f.bottom * int(rng, multiplier);
    const ans = (whole * f.top) / f.bottom;
    // The same number with a different fraction is the likeliest mix-up.
    const others = FRACTIONS.filter((o) => o !== f).map((o) => (whole * o.top) / o.bottom);
    return { text: `${f.words} of ${whole} = ?`, answer: ans, near: [...others, ans + 1, ans - 1, ans + 2] };
  };
}

// Each percentage paired with the step that keeps the answer whole.
const PERCENTS = [
  { pct: 10, step: 10 },
  { pct: 20, step: 5 },
  { pct: 25, step: 4 },
  { pct: 50, step: 2 },
  { pct: 75, step: 4 },
] as const;

function percentOf(multiplier: Range): Maker {
  return (rng) => {
    const { pct, step } = pick(rng, PERCENTS);
    const whole = step * int(rng, multiplier);
    const ans = (whole * pct) / 100;
    const others = PERCENTS.filter((o) => o.pct !== pct).map((o) => (whole * o.pct) / 100);
    // pct itself: answered with the percentage instead of the amount.
    return { text: `${pct}% of ${whole} = ?`, answer: ans, near: [...others, pct, ans + 1, ans - 1] };
  };
}

// ---- Levels ---------------------------------------------------------------

// Four tiers per age group, easiest first. Each round picks one kind from its tier.
const LEVELS: Record<AgeGroup, Maker[][]> = {
  "7-8": [
    [add([1, 9], [1, 9], 10), sub([2, 10], [1, 9])],
    [add([2, 12], [2, 9], 20), sub([11, 20], [2, 9])],
    [add([10, 89], [2, 9], 99), sub([20, 99], [2, 9])],
    [times([2, 5, 10], [2, 10]), add([10, 60], [10, 39], 99), sub([30, 99], [10, 29])],
  ],
  "9-10": [
    [add([12, 79], [11, 49], 100), sub([30, 99], [11, 29])],
    [times(TABLES_2_TO_10, [2, 10])],
    [divide(TABLES_2_TO_10, [2, 10]), missingNumber([11, 59], [11, 39])],
    [add([100, 899], [25, 99], 999), sub([200, 999], [25, 199]), multiply([11, 29], [2, 5])],
  ],
  "11-12": [
    [times(TABLES_2_TO_12, [2, 12]), divide(TABLES_2_TO_12, [2, 12])],
    [multiply([12, 49], [3, 9]), divide([3, 4, 5, 6, 7, 8, 9], [12, 30])],
    [twoStep(TABLES_2_TO_12, [2, 12], [2, 30]), fractionOf([3, 12])],
    [orderOfOperations([2, 30], [2, 12], [2, 12]), percentOf([2, 20]), twoStep(TABLES_2_TO_12, [3, 12], [5, 40])],
  ],
};

// Rounds 1–3, 4–6, 7–8 and 9–10 of a 10-round game. Other lengths scale to fit.
const TIER_OF_TEN = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3];

export function tierForRound(round: number, totalRounds: number): number {
  const i = Math.floor(((round - 1) * TIER_OF_TEN.length) / totalRounds);
  return TIER_OF_TEN[Math.min(Math.max(i, 0), TIER_OF_TEN.length - 1)];
}

function toQuestion(p: Problem, rng: Rng): Question {
  const wrong = new Set<number>();
  for (const n of shuffle(p.near, rng)) {
    if (wrong.size === 3) break;
    if (Number.isInteger(n) && n >= 0 && n !== p.answer) wrong.add(n);
  }
  // Small answers can run out of near misses (nothing below 0), so top up with neighbours.
  for (let step = 1; wrong.size < 3; step++) {
    for (const n of [p.answer + step, p.answer - step]) {
      if (wrong.size < 3 && n >= 0) wrong.add(n);
    }
  }
  const choices = shuffle([p.answer, ...wrong], rng);
  return { text: p.text, choices: choices.map(String), correctIndex: choices.indexOf(p.answer) };
}

/** One question for `round` (1-based) of a `totalRounds` game. */
export function makeQuestion(ageGroup: AgeGroup, round: number, totalRounds: number, rng: Rng = Math.random): Question {
  const tier = LEVELS[ageGroup][tierForRound(round, totalRounds)];
  return toQuestion(pick(rng, tier)(rng), rng);
}

/** A whole game's questions at once, with no question repeated. */
export function makeQuestionSet(ageGroup: AgeGroup, totalRounds: number, rng: Rng = Math.random): Question[] {
  const seen = new Set<string>();
  const set: Question[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    let q = makeQuestion(ageGroup, round, totalRounds, rng);
    for (let tries = 0; seen.has(q.text) && tries < 20; tries++) {
      q = makeQuestion(ageGroup, round, totalRounds, rng);
    }
    seen.add(q.text);
    set.push(q);
  }
  return set;
}
