import { Button } from "../ui/Button";
import { Leaderboard } from "../ui/Leaderboard";
import { formatScore, isTied, ordinal, rankPlayers, useFocusOnMount, type GameSnapshot } from "../gameState";

interface PodiumProps {
  state: GameSnapshot;
  mySessionId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}

// Taller block for a better rank. Classes spelled out so Tailwind keeps them.
const BLOCK_HEIGHT: Record<number, string> = { 1: "h-36", 2: "h-28", 3: "h-20" };
// Visual order on the stand is 2nd, 1st, 3rd. The DOM stays 1st, 2nd, 3rd for screen readers.
const STAND_ORDER = ["order-2", "order-1", "order-3"];

export function Podium({ state, mySessionId, onPlayAgain, onLeave }: PodiumProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const ranked = rankPlayers(state.players);
  const winners = ranked.filter((p) => p.rank === 1);
  const me = ranked.find((p) => p.sessionId === mySessionId);
  const host = ranked.find((p) => p.isHost);

  const headline =
    winners.length > 1 ? "It's a tie!" : winners[0]?.sessionId === mySessionId ? "You win!" : `${winners[0]?.name} wins!`;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-4">
      <p className="font-display text-xl font-semibold">Quiz Battle</p>

      <h1 ref={headingRef} tabIndex={-1} className="outline-none mt-6 text-center text-5xl font-semibold wrap-anywhere">
        {headline}
      </h1>
      {me && (
        <p className="mt-2 text-center text-lg">
          {isTied(ranked, me.rank) ? "You tied for" : "You came"} {ordinal(me.rank)} with {formatScore(me.score)} points.
        </p>
      )}

      <ol aria-label="Top three" className="mt-8 flex items-end gap-2 border-b-2 border-ink">
        {ranked.slice(0, 3).map((p, i) => (
          <li key={p.sessionId} className={`flex min-w-0 flex-1 flex-col items-center ${STAND_ORDER[i]}`}>
            <span className="w-full text-center font-semibold wrap-anywhere">
              {p.name}
              {p.sessionId === mySessionId && <span className="sr-only"> (you)</span>}
            </span>
            <span className="text-sm text-ink-soft tabular-nums">{formatScore(p.score)}</span>
            <span
              className={[
                "mt-2 grid w-full place-items-center rounded-t-2xl border-2 border-b-0 font-display text-4xl font-semibold",
                BLOCK_HEIGHT[p.rank] ?? BLOCK_HEIGHT[3],
                p.rank === 1 ? "border-ink bg-ink text-white" : "border-ink bg-white",
              ].join(" ")}
            >
              <span className="sr-only">Place </span>
              {p.rank}
            </span>
          </li>
        ))}
      </ol>

      {ranked.length > 3 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold">All scores</h2>
          <div className="mt-3">
            <Leaderboard ranked={ranked} mySessionId={mySessionId} label="All scores" />
          </div>
        </div>
      )}

      {/* Pinned like the Lobby's Start bar: with 8 players the scores push it below the fold. */}
      <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 border-t-2 border-paper-deep bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">

        {me?.isHost ? (
          <Button variant="primary" onClick={onPlayAgain} className="w-full">
            Play again
          </Button>
        ) : (
          <p className="py-2 text-center text-lg font-semibold">
            Waiting for {host?.name ?? "the host"} to start another game.
          </p>
        )}
        <Button onClick={onLeave} className="w-full">
          Leave room
        </Button>
      </div>
    </main>
  );
}
