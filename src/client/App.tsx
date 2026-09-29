import { useEffect, useState } from "react";
import { client } from "./colyseus";

type ServerStatus = "checking" | "up" | "down";

// M0 placeholder: proves React, Tailwind and the client-to-server link work.
// The Home and Lobby screens replace it in M1.
export function App() {
  const [status, setStatus] = useState<ServerStatus>("checking");

  useEffect(() => {
    client.http
      .get("/api/hello")
      .then(() => setStatus("up"))
      .catch(() => setStatus("down"));
  }, []);

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto max-w-md">
        <h1 className="text-4xl font-bold">Quiz Battle</h1>
        <p className="mt-4 text-lg">
          Game server:{" "}
          <span className={status === "down" ? "text-red-300" : "text-emerald-300"}>
            {status === "checking" ? "checking…" : status === "up" ? "connected" : "not reachable"}
          </span>
        </p>
        <p className="mt-2 text-slate-300">
          Open <a className="underline" href="/playground">/playground</a> to join a room by hand.
        </p>
      </div>
    </main>
  );
}
