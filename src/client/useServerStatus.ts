import { useCallback, useEffect, useState } from "react";
import { client } from "./colyseus";

export type ServerStatus = "checking" | "waking" | "ready" | "unreachable";

// Render's free server sleeps after 15 minutes with no players and takes about a
// minute to wake. The page itself (on Vercel) loads instantly, so it can say so
// instead of leaving players staring at a join button that hangs.
const SHOW_WAKING_AFTER_MS = 1500;
const RETRY_EVERY_MS = 3000;
const GIVE_UP_AFTER_MS = 120_000;

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    setStatus("checking");
    // Only mention waking if it's slow, so a server that's already up causes no flash.
    const slow = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "checking" ? "waking" : s));
    }, SHOW_WAKING_AFTER_MS);

    (async () => {
      while (!cancelled) {
        try {
          const res = await client.http.get("/health");
          if (res.data?.ok) {
            if (!cancelled) setStatus("ready");
            return;
          }
        } catch {
          // Not up yet (or offline). Try again below.
        }
        if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
          if (!cancelled) setStatus("unreachable");
          return;
        }
        await new Promise((r) => setTimeout(r, RETRY_EVERY_MS));
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { status, retry };
}
