import { useEffect, useState } from "react";
import { useRoom, useRoomState } from "@colyseus/react";
import { CloseCode, ErrorCode, type Room } from "@colyseus/sdk";
import type { QuizRoom } from "../rooms/QuizRoom";
import { client } from "./colyseus";
import { readInviteCode } from "./inviteLink";
import { Home } from "./screens/Home";
import { Lobby, type LobbyPlayer } from "./screens/Lobby";
import { GameView } from "./screens/GameView";
import { DEFAULT_AGE_GROUP, type AgeGroup } from "../shared/ageGroups";
import { MAX_PLAYERS, MIN_PLAYERS } from "../shared/rules";

type Connect =
  | { kind: "create"; name: string; ageGroup: AgeGroup }
  | { kind: "join"; code: string; name: string }
  | { kind: "rejoin"; token: string };

// Saved per browser tab, so a refresh mid-game puts the player back in their seat.
const TOKEN_KEY = "quiz-battle:reconnect";

function savedToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked (private mode): refresh just won't rejoin.
  }
}

function connect(request: Connect): Promise<Room<QuizRoom>> {
  switch (request.kind) {
    case "create":
      return client.create("quiz_room", { name: request.name, ageGroup: request.ageGroup });
    case "join":
      return client.joinById<QuizRoom>(request.code, { name: request.name });
    case "rejoin":
      return client.reconnect<QuizRoom>(request.token);
  }
}

/** Turns a failed create/join into something a kid (or their teacher) can act on. */
function explain(error: Error): string {
  const code = (error as { code?: number }).code;
  // The room's own refusals (nickname taken, etc.) are already written for players.
  if (code === ErrorCode.APPLICATION_ERROR) return error.message;
  if (/not found|disposed/.test(error.message)) return "There's no game with that code. Check the letters with your friend.";
  if (/locked/.test(error.message)) return "That game is full or has already started. Ask the host to press Play again, or create your own room.";
  return "Couldn't reach the game server. Check your internet connection, then try again.";
}

export function App() {
  const [request, setRequest] = useState<Connect | null>(() => {
    const token = savedToken();
    return token ? { kind: "rejoin", token } : null;
  });
  const [homeError, setHomeError] = useState<string>();
  const [lastName, setLastName] = useState("");
  const [lastAgeGroup, setLastAgeGroup] = useState<AgeGroup>(DEFAULT_AGE_GROUP);
  const [dropped, setDropped] = useState(false);
  const [starting, setStarting] = useState(false);

  const { room, error } = useRoom(request ? () => connect(request) : null, [request]);
  const snapshot = useRoomState(room);
  // The first snapshot can land before the full state has been decoded.
  const state = snapshot?.players ? snapshot : undefined;

  // Create, join or rejoin failed.
  useEffect(() => {
    if (!error || !request) return;
    saveToken(null);
    // A stale rejoin (the game ended, or the seat was given up) just lands on Home quietly.
    setHomeError(request.kind === "rejoin" ? undefined : explain(error));
    setRequest(null);
  }, [error]);

  // Connected: remember how to get back in, and follow the connection.
  useEffect(() => {
    if (!room) return;
    saveToken(room.reconnectionToken);
    const onDrop = () => setDropped(true);
    const onReconnect = () => {
      setDropped(false);
      saveToken(room.reconnectionToken);
    };
    const onLeave = (code: number) => {
      saveToken(null);
      setDropped(false);
      setRequest(null);
      if (code !== CloseCode.CONSENTED) setHomeError("You lost connection to the game and couldn't get back in.");
    };
    room.onDrop(onDrop);
    room.onReconnect(onReconnect);
    room.onLeave(onLeave);
    return () => {
      room.onDrop.remove(onDrop);
      room.onReconnect.remove(onReconnect);
      room.onLeave.remove(onLeave);
    };
  }, [room]);

  // "Starting…" lasts until the server moves the room out of the lobby.
  useEffect(() => setStarting(false), [state?.phase]);

  function leave() {
    // Keep the nickname for Home, even after a refresh-rejoin where we never typed it.
    const myName = room && state?.players[room.sessionId]?.name;
    if (myName) setLastName(myName);
    saveToken(null);
    setRequest(null); // useRoom leaves the room
  }

  if (!room) {
    if (request?.kind === "rejoin") {
      return (
        <main className="grid min-h-dvh place-items-center px-4">
          <p role="status" className="font-display text-2xl font-semibold">
            Getting you back into your game…
          </p>
        </main>
      );
    }
    return (
      <Home
        initialCode={readInviteCode()}
        initialName={lastName}
        initialAgeGroup={lastAgeGroup}
        busy={request ? (request.kind === "create" ? "create" : "join") : null}
        error={homeError}
        onCreate={(name, ageGroup) => {
          setLastName(name);
          setLastAgeGroup(ageGroup);
          setHomeError(undefined);
          setRequest({ kind: "create", name, ageGroup });
        }}
        onJoin={(code, name) => {
          setLastName(name);
          setHomeError(undefined);
          setRequest({ kind: "join", code, name });
        }}
      />
    );
  }

  const players: LobbyPlayer[] | undefined = state
    ? Object.entries(state.players).map(([sessionId, p]) => ({ sessionId, name: p.name, isHost: p.isHost, connected: p.connected }))
    : undefined;

  return (
    <>
      {dropped && (
        <p role="status" className="sticky top-0 z-10 bg-ink px-4 py-3 text-center font-semibold text-white">
          Connection lost. Reconnecting…
        </p>
      )}
      {!state || state.phase === "lobby" ? (
        <Lobby
          code={room.roomId}
          ageGroup={state?.ageGroup ?? DEFAULT_AGE_GROUP}
          players={players}
          mySessionId={room.sessionId}
          minPlayers={MIN_PLAYERS}
          maxPlayers={MAX_PLAYERS}
          starting={starting}
          onStart={() => {
            setStarting(true);
            room.send("start");
          }}
          onLeave={leave}
        />
      ) : (
        <GameView
          state={state}
          mySessionId={room.sessionId}
          onAnswer={(choice) => room.send("answer", { choice })}
          onPlayAgain={() => room.send("playAgain")}
          onLeave={leave}
        />
      )}
    </>
  );
}
