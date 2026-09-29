import { useState } from "react";
import { Button } from "../ui/Button";
import { inviteUrl } from "../inviteLink";

export interface LobbyPlayer {
  sessionId: string;
  name: string;
  isHost: boolean;
  connected: boolean;
}

interface LobbyProps {
  code: string;
  /** Undefined until the first room state arrives. */
  players: LobbyPlayer[] | undefined;
  mySessionId: string;
  minPlayers: number;
  maxPlayers: number;
  /** True after the host presses Start, until the server moves the room on. */
  starting?: boolean;
  onStart: () => void;
  onLeave: () => void;
}

type ShareStatus = "idle" | "copied" | "failed";

export function Lobby({ code, players, mySessionId, minPlayers, maxPlayers, starting = false, onStart, onLeave }: LobbyProps) {
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const link = inviteUrl(code);

  const me = players?.find((p) => p.sessionId === mySessionId);
  const host = players?.find((p) => p.isHost);
  const count = players?.length ?? 0;
  const missing = Math.max(0, minPlayers - count);

  async function share() {
    // Phones get the system share sheet (WhatsApp, Telegram…). Desktops copy the link.
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: "Quiz Battle", text: `Join my Quiz Battle room: ${code}`, url: link });
        return;
      } catch (err) {
        if ((err as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setShareStatus("copied");
    } catch {
      // No clipboard on plain http (e.g. testing over LAN), so show the link to copy by hand.
      setShareStatus("failed");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-4 md:max-w-4xl md:pt-8">
      <header className="flex items-center justify-between gap-4">
        <p className="font-display text-xl font-semibold">Quiz Battle</p>
        <Button onClick={onLeave} className="min-h-11 px-4 text-base">
          Leave room
        </Button>
      </header>

      <div className="mt-8 flex flex-col gap-10 md:grid md:grid-cols-2 md:gap-12">
        <section aria-labelledby="code-heading">
          <h1 id="code-heading" className="text-lg font-semibold text-ink-soft">
            Room code
          </h1>
          <p className="sr-only">{code.split("").join(" ")}</p>
          <div aria-hidden className="mt-2 flex gap-2 sm:gap-3">
            {code.split("").map((letter, i) => (
              <span
                key={i}
                className="grid size-16 place-items-center rounded-2xl border-2 border-ink bg-white font-display text-4xl font-semibold sm:size-20 sm:text-5xl"
              >
                {letter}
              </span>
            ))}
          </div>
          <p className="mt-4 text-ink-soft">Friends open the game and type this code, or you send them the link.</p>
          <Button onClick={share} className="mt-4 w-full sm:w-auto">
            Share invite link
          </Button>
          <div aria-live="polite" className="mt-2 min-h-6">
            {shareStatus === "copied" && <p className="font-semibold">Link copied. Paste it in your group chat.</p>}
            {shareStatus === "failed" && (
              <p>
                Couldn't copy automatically. Copy this link:{" "}
                <span className="select-all break-all font-semibold">{link}</span>
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="players-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="players-heading" className="text-2xl font-semibold">
              Players
            </h2>
            {players && (
              <p className="text-ink-soft">
                <span className="font-semibold text-ink">{count}</span> of {maxPlayers}
              </p>
            )}
          </div>

          {!players ? (
            <p role="status" className="mt-3 rounded-2xl bg-paper-deep px-4 py-6 text-center text-ink-soft">
              Loading players…
            </p>
          ) : (
            <>
              <ul className="mt-3 divide-y-2 divide-paper-deep rounded-2xl border-2 border-paper-deep bg-white">
                {players.map((p) => (
                  <li key={p.sessionId} className="flex min-h-14 items-center gap-3 px-4 py-2">
                    <span className={`min-w-0 flex-1 text-lg font-semibold wrap-anywhere ${p.connected ? "" : "text-ink-soft"}`}>
                      {p.name}
                    </span>
                    {!p.connected && <span className="text-sm text-ink-soft">Offline</span>}
                    {p.sessionId === mySessionId && (
                      <span className="rounded-md border-2 border-ink px-2 text-sm font-semibold">You</span>
                    )}
                    {p.isHost && <span className="rounded-md bg-ink px-2 py-0.5 text-sm font-semibold text-white">Host</span>}
                  </li>
                ))}
              </ul>
              {count === 1 && (
                <p className="mt-3 text-ink-soft">It's just you so far. Share the code and friends can join from their own phones.</p>
              )}
              {count >= maxPlayers && <p className="mt-3 font-semibold">The room is full.</p>}
            </>
          )}
        </section>
      </div>

      <footer className="sticky bottom-0 -mx-4 mt-auto border-t-2 border-paper-deep bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:static md:mx-0 md:mt-10 md:border-0 md:px-0">
        {!players ? null : me?.isHost ? (
          <div className="flex flex-col gap-2 md:flex-row-reverse md:items-center md:justify-start md:gap-6">
            <Button
              variant="primary"
              onClick={() => !starting && onStart()}
              busy={starting}
              disabled={missing > 0}
              className="w-full md:w-auto md:min-w-64"
            >
              {starting ? "Starting…" : "Start game"}
            </Button>
            <p className="text-center text-ink-soft md:text-left">
              {missing > 0
                ? `Need ${missing} more player${missing === 1 ? "" : "s"} to start.`
                : "Nobody else can join once the game starts."}
            </p>
          </div>
        ) : (
          <p className="py-3 text-center text-lg font-semibold">
            {host && !host.connected
              ? `${host.name} (the host) is offline. Waiting for them to come back.`
              : `Waiting for ${host ? host.name : "the host"} to start the game.`}
          </p>
        )}
      </footer>
    </main>
  );
}
