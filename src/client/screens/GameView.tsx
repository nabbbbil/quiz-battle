import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { QUESTION_SECONDS, type Phase } from "../../shared/rules";

// TEMPORARY: a plain, working stand-in for the Question, Reveal and Podium
// screens so a full game can be played and tested. The designed screens replace it.

interface PlayerView {
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

interface GameViewProps {
  state: GameSnapshot;
  mySessionId: string;
  onAnswer: (choice: number) => void;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function GameView({ state, mySessionId, onAnswer, onPlayAgain, onLeave }: GameViewProps) {
  // The server keeps everyone's pick secret until reveal, so remember our own locally.
  const [myChoice, setMyChoice] = useState<number | null>(null);
  useEffect(() => setMyChoice(null), [state.round]);

  const me = state.players[mySessionId];
  const ranked = Object.entries(state.players).sort(([, a], [, b]) => b.score - a.score);
  const online = ranked.filter(([, p]) => p.connected);
  const answered = online.filter(([, p]) => p.hasAnswered).length;
  const iAnswered = myChoice !== null || me?.hasAnswered;

  if (state.phase === "podium") {
    const host = ranked.find(([, p]) => p.isHost)?.[1];
    return (
      <Screen>
        <h1 className="text-4xl font-semibold">Final scores</h1>
        <Scoreboard ranked={ranked} mySessionId={mySessionId} className="mt-6" />
        <div className="mt-8 flex flex-col gap-3">
          {me?.isHost ? (
            <Button variant="primary" onClick={onPlayAgain} className="w-full">
              Play again
            </Button>
          ) : (
            <p className="text-center text-lg font-semibold">Waiting for {host?.name ?? "the host"} to start another game.</p>
          )}
          <Button onClick={onLeave} className="w-full">
            Leave room
          </Button>
        </div>
      </Screen>
    );
  }

  const revealing = state.phase === "reveal";
  const secondsWidth = `${Math.round((state.timeLeft / QUESTION_SECONDS) * 100)}%`;

  return (
    <Screen>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-lg font-semibold">
          Round {state.round} of {state.totalRounds}
        </p>
        {!revealing && (
          <p className="font-display text-lg font-semibold" aria-live="off">
            {state.timeLeft} s
          </p>
        )}
      </div>
      <div className="mt-2 h-2 rounded-full bg-paper-deep" aria-hidden>
        <div
          className="h-2 rounded-full bg-ink transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
          style={{ width: revealing ? "0%" : secondsWidth }}
        />
      </div>

      <h1 className="mt-8 text-center text-5xl font-semibold">{state.questionText}</h1>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {state.choices.map((choice, i) => {
          const isRight = revealing && i === state.correctIndex;
          const isMine = (revealing ? me?.lastAnswer : myChoice) === i;
          return (
            <button
              key={i}
              type="button"
              disabled={revealing || iAnswered}
              onClick={() => {
                setMyChoice(i);
                onAnswer(i);
              }}
              className={[
                "flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 px-2 font-display text-3xl font-semibold",
                isRight
                  ? "border-ink bg-ink text-white"
                  : isMine
                    ? "border-ink bg-paper-deep text-ink"
                    : "border-line bg-white text-ink disabled:text-ink-soft",
              ].join(" ")}
            >
              {choice}
              {isRight && <span className="text-sm font-semibold">Right answer</span>}
              {!isRight && isMine && <span className="text-sm font-semibold">{revealing ? "Your answer" : "Locked in"}</span>}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="mt-6 text-center text-lg font-semibold">
        {revealing ? (
          me && me.lastGain > 0 ? (
            <p>Right! +{me.lastGain} points</p>
          ) : (
            <p className="text-red-deep">{me && me.lastAnswer >= 0 ? "Not this time." : "No answer this round."}</p>
          )
        ) : iAnswered ? (
          <p>
            Locked in. {answered} of {online.length} answered.
          </p>
        ) : null}
      </div>

      {revealing && <Scoreboard ranked={ranked} mySessionId={mySessionId} className="mt-6" />}
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-6">
      {children}
      <p className="mt-auto pt-10 text-center text-sm text-ink-soft">Temporary game screen. The designed one comes next.</p>
    </main>
  );
}

function Scoreboard({ ranked, mySessionId, className = "" }: { ranked: [string, PlayerView][]; mySessionId: string; className?: string }) {
  return (
    <ol className={`divide-y-2 divide-paper-deep rounded-2xl border-2 border-paper-deep bg-white ${className}`}>
      {ranked.map(([sessionId, p], i) => (
        <li key={sessionId} className="flex min-h-12 items-center gap-3 px-4 py-2">
          <span className="w-6 font-display font-semibold">{i + 1}</span>
          <span className={`min-w-0 flex-1 font-semibold wrap-anywhere ${p.connected ? "" : "text-ink-soft"}`}>
            {p.name}
            {sessionId === mySessionId && <span className="ml-2 rounded-md border-2 border-ink px-1.5 text-sm">You</span>}
          </span>
          <span className="font-display font-semibold tabular-nums">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}
