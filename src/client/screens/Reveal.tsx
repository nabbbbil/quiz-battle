import { Equation } from "../ui/Equation";
import { Leaderboard } from "../ui/Leaderboard";
import { isTied, ordinal, rankPlayers, useFocusOnMount, type GameSnapshot } from "../gameState";

interface RevealProps {
  state: GameSnapshot;
  mySessionId: string;
}

// Shown for 4 seconds, so it has to read at a glance: your result first,
// then the answer, then where everyone stands.
export function Reveal({ state, mySessionId }: RevealProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const me = state.players[mySessionId];
  const ranked = rankPlayers(state.players);
  const myRank = ranked.find((p) => p.sessionId === mySessionId)?.rank;
  const lastRound = state.round >= state.totalRounds;

  const outcome = !me || me.lastAnswer < 0 ? "none" : me.lastGain > 0 ? "right" : "wrong";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-4">
      <header className="flex items-center justify-between gap-4">
        <p className="font-display text-lg font-semibold">
          Round {state.round} <span className="text-ink-soft">of {state.totalRounds}</span>
        </p>
        <p className="text-ink-soft">{lastRound ? "Final scores next" : "Next question soon"}</p>
      </header>

      <section
        className={[
          "mt-6 rounded-2xl px-4 py-6 text-center",
          outcome === "right"
            ? "bg-ink text-white"
            : outcome === "wrong"
              ? "border-2 border-red-deep bg-red-tint text-red-deep"
              : "border-2 border-dashed border-line bg-white",
        ].join(" ")}
      >
        <h1 ref={headingRef} tabIndex={-1} className="outline-none text-3xl font-semibold">
          {outcome === "right" ? "Correct!" : outcome === "wrong" ? "Not quite" : "Time's up"}
        </h1>
        {outcome === "right" && <p className="mt-1 font-display text-6xl font-semibold tabular-nums">+{me!.lastGain}</p>}
        {outcome === "wrong" && <p className="mt-2 text-lg">You picked {state.choices[me!.lastAnswer]}.</p>}
        {outcome === "none" && <p className="mt-2 text-lg">No answer this round.</p>}
      </section>

      <div className="mt-8">
        <Equation text={state.questionText} answer={state.choices[state.correctIndex]} />
      </div>

      {myRank !== undefined && (
        <p className="mt-8 text-center text-lg font-semibold">
          {isTied(ranked, myRank) ? `You're tied for ${ordinal(myRank)}.` : `You're in ${ordinal(myRank)} place.`}
        </p>
      )}
      <div className="mt-3">
        <Leaderboard ranked={ranked} mySessionId={mySessionId} label="Scores so far" showGain />
      </div>
    </main>
  );
}
