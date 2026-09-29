const OPERATORS = new Set(["+", "−", "×", "÷"]);
const SPOKEN: Record<string, string> = { "+": "plus", "−": "minus", "×": "times", "÷": "divided by", "=": "equals", "?": "what" };

interface EquationProps {
  /** Question text from the server, e.g. "7 × 8 = ?". Tokens are separated by spaces. */
  text: string;
  /** Fills the "?" box at reveal. */
  answer?: string;
}

// The question laid out as tiles: operators in red tiles like the Math Quiz
// Game's + − × ÷ buttons (and because the operator is the part kids misread),
// and the "?" as an empty box to fill. At reveal the box fills with the answer.
export function Equation({ text, answer }: EquationProps) {
  const tokens = text.split(" ");
  // Two-step questions ("30 + 12 × 12 = ?") get a size down on phones so they stay on one line.
  const long = tokens.length > 5;
  const spoken = tokens
    .map((t) => (t === "?" && answer !== undefined ? answer : (SPOKEN[t] ?? t)))
    .join(" ");

  return (
    <span className="block">
      <span className="sr-only">{spoken}</span>
      <span
        aria-hidden
        className={`flex flex-wrap items-center justify-center gap-y-3 font-display font-semibold sm:gap-x-3 sm:text-5xl ${long ? "gap-x-1.5 text-3xl" : "gap-x-2 text-4xl"}`}
      >
        {tokens.map((token, i) =>
          OPERATORS.has(token) ? (
            <span
              key={i}
              className={`grid place-items-center rounded-xl bg-red text-white sm:size-14 sm:text-4xl ${long ? "size-9 text-2xl" : "size-11 text-3xl"}`}
            >
              {token}
            </span>
          ) : token === "?" ? (
            <span
              key={i}
              className={[
                "grid place-items-center rounded-xl border-2 tabular-nums sm:h-16 sm:min-w-16 sm:px-3",
                long ? "h-12 min-w-14 px-2" : "h-14 min-w-16 px-3",
                answer === undefined ? "border-dashed border-ink" : "border-ink bg-ink text-white",
              ].join(" ")}
            >
              {answer ?? ""}
            </span>
          ) : (
            <span key={i} className="tabular-nums">
              {token}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
