import { useState } from "react";
import { Equation } from "../ui/Equation";
import { useFocusOnMount, type GameSnapshot } from "../gameState";
import { QUESTION_SECONDS } from "../../shared/rules";

interface QuestionProps {
  state: GameSnapshot;
  mySessionId: string;
  onAnswer: (choice: number) => void;
}

// Mounted fresh each round (App keys it by round), so local state resets on its own.
export function Question({ state, mySessionId, onAnswer }: QuestionProps) {
  // The server keeps picks secret until reveal, so remember our own here.
  const [myChoice, setMyChoice] = useState<number | null>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  const me = state.players[mySessionId];
  // After a refresh mid-question we lose myChoice, but the server still says we answered.
  const locked = myChoice !== null || me?.hasAnswered === true;
  const online = Object.values(state.players).filter((p) => p.connected);
  const answered = online.filter((p) => p.hasAnswered).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-4">
      <header className="flex items-center justify-between gap-4">
        <p className="font-display text-lg font-semibold">
          Round {state.round} <span className="text-ink-soft">of {state.totalRounds}</span>
        </p>
        <p className="font-display text-2xl font-semibold tabular-nums">
          {state.timeLeft}
          <span className="sr-only"> seconds left</span>
          <span aria-hidden className="ml-0.5 text-base text-ink-soft">
            s
          </span>
        </p>
      </header>
      <TimerBar timeLeft={state.timeLeft} />

      <h1 ref={headingRef} tabIndex={-1} className="outline-none mt-10">
        <Equation text={state.questionText} />
      </h1>

      <div role="group" aria-label="Answers" className="mt-10 grid grid-cols-2 gap-3">
        {state.choices.map((choice, i) => {
          const chosen = myChoice === i;
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => {
                setMyChoice(i);
                onAnswer(i);
              }}
              className={[
                "flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 px-2 font-display text-4xl font-semibold tabular-nums",
                chosen
                  ? // Stays pressed in: the same tile, sunk, so it reads as "this is mine".
                    "translate-y-[3px] border-ink bg-ink text-white"
                  : locked
                    ? "border-line bg-white text-ink-soft"
                    : "border-ink bg-white shadow-[0_4px_0_var(--color-ink)] transition-[translate,box-shadow] duration-75 active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-ink)] motion-reduce:transition-none",
              ].join(" ")}
            >
              {choice}
              {chosen && <span className="font-sans text-sm font-semibold">Your answer</span>}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-6 text-center text-lg">
        {locked ? (
          <>
            <span className="font-semibold">Locked in.</span> {answered} of {online.length} have answered.
          </>
        ) : (
          <span className="text-ink-soft">
            {answered} of {online.length} have answered
          </span>
        )}
      </p>
    </main>
  );
}

// Drains smoothly between the server's once-a-second updates. It starts from
// however much time the server says is left, so a player who rejoins
// mid-question sees the right amount. The number above is the server's truth.
function TimerBar({ timeLeft }: { timeLeft: number }) {
  const [elapsed] = useState(() => QUESTION_SECONDS - timeLeft);
  return (
    <div aria-hidden className="mt-2 h-3 overflow-hidden rounded-full bg-paper-deep">
      <div
        className="h-full origin-left rounded-full bg-ink animate-drain motion-reduce:hidden"
        style={{ animationDuration: `${QUESTION_SECONDS}s`, animationDelay: `-${elapsed}s` }}
      />
      <div className="hidden h-full rounded-full bg-ink motion-reduce:block" style={{ width: `${(timeLeft / QUESTION_SECONDS) * 100}%` }} />
    </div>
  );
}
