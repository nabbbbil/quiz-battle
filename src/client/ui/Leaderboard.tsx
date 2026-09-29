import { formatScore, type RankedPlayer } from "../gameState";

interface LeaderboardProps {
  ranked: RankedPlayer[];
  mySessionId: string;
  label: string;
  /** Show the points each player won in the round just revealed. */
  showGain?: boolean;
}

export function Leaderboard({ ranked, mySessionId, label, showGain = false }: LeaderboardProps) {
  return (
    <ol aria-label={label} className="divide-y-2 divide-paper-deep rounded-2xl border-2 border-paper-deep bg-white">
      {ranked.map((p) => (
        <li key={p.sessionId} className="flex min-h-12 items-center gap-3 px-4 py-2">
          <span className="w-6 shrink-0 font-display text-lg font-semibold tabular-nums">{p.rank}</span>
          <span className={`min-w-0 flex-1 font-semibold wrap-anywhere ${p.connected ? "" : "text-ink-soft"}`}>{p.name}</span>
          {!p.connected && <span className="text-sm text-ink-soft">Offline</span>}
          {p.sessionId === mySessionId && <span className="rounded-md border-2 border-ink px-1.5 text-sm font-semibold">You</span>}
          {showGain && p.lastGain > 0 && <span className="text-sm font-semibold text-ink-soft tabular-nums">+{p.lastGain}</span>}
          <span className="min-w-14 text-right font-display text-lg font-semibold tabular-nums">{formatScore(p.score)}</span>
        </li>
      ))}
    </ol>
  );
}
