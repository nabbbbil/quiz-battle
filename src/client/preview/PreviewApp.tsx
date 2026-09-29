import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Home, type HomeBusy } from "../screens/Home";
import { Lobby, type LobbyPlayer } from "../screens/Lobby";
import { readInviteCode } from "../inviteLink";
import { DEFAULT_AGE_GROUP, type AgeGroup } from "../../shared/ageGroups";

// Runs the screens on sample data so they can be checked before QuizRoom
// exists. Nothing here talks to the server. Delete this folder once the real
// room is wired in.

const SAMPLE_CODE = "KTPQ";
const ME = "me";
const FAKE_DELAY_MS = 700;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

let nextSample = 1;
function samplePlayer(isHost = false): LobbyPlayer {
  const n = nextSample++;
  return { sessionId: `sample-${n}`, name: `Sample ${n}`, isHost, connected: true };
}

export function PreviewApp() {
  const [screen, setScreen] = useState<"home" | "lobby">("home");
  const [busy, setBusy] = useState<HomeBusy>(null);
  const [error, setError] = useState<string>();
  const [failNext, setFailNext] = useState(false);
  const [code, setCode] = useState("");
  const [players, setPlayers] = useState<LobbyPlayer[]>();
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [lastName, setLastName] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(DEFAULT_AGE_GROUP);

  function fakeRequest(kind: "create" | "join", succeed: () => void, failMessage: string) {
    setBusy(kind);
    setError(undefined);
    setTimeout(() => {
      setBusy(null);
      if (failNext) setError(failMessage);
      else succeed();
    }, FAKE_DELAY_MS);
  }

  function enterLobby(roomCode: string, list: LobbyPlayer[]) {
    setLastName(list.find((p) => p.sessionId === ME)?.name ?? "");
    setCode(roomCode);
    setPlayers(undefined);
    setScreen("lobby");
    // A beat of "Loading players…", like waiting for the first room state.
    setTimeout(() => setPlayers(list), FAKE_DELAY_MS);
  }

  if (screen === "home") {
    return (
      <>
        <Home
          initialCode={readInviteCode()}
          initialName={lastName}
          initialAgeGroup={ageGroup}
          busy={busy}
          error={error}
          onCreate={(name, group) =>
            fakeRequest(
              "create",
              () => {
                setAgeGroup(group);
                enterLobby(SAMPLE_CODE, [{ sessionId: ME, name, isHost: true, connected: true }]);
              },
              "Sample error: the game server didn't answer. Check it's running, then try again.",
            )
          }
          onJoin={(roomCode, name) =>
            fakeRequest(
              "join",
              () => enterLobby(roomCode, [samplePlayer(true), { sessionId: ME, name, isHost: false, connected: true }]),
              `Sample error: there's no room with the code ${roomCode}. Check the letters with your friend.`,
            )
          }
        />
        <PreviewPanel>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} className="size-5" />
            Make create and join fail
          </label>
        </PreviewPanel>
      </>
    );
  }

  const list = players ?? [];
  const others = list.filter((p) => p.sessionId !== ME);
  const iAmHost = list.find((p) => p.sessionId === ME)?.isHost ?? false;

  function setHost(sessionId: string) {
    setPlayers(list.map((p) => ({ ...p, isHost: p.sessionId === sessionId })));
  }

  return (
    <>
      <Lobby
        code={code}
        ageGroup={ageGroup}
        players={players}
        mySessionId={ME}
        minPlayers={MIN_PLAYERS}
        maxPlayers={MAX_PLAYERS}
        starting={starting}
        onStart={() => {
          setStarting(true);
          setTimeout(() => {
            setStarting(false);
            setNotice("Start works. The Question screen arrives in M2, so the preview stays here.");
          }, FAKE_DELAY_MS);
        }}
        onLeave={() => {
          setScreen("home");
          setPlayers(undefined);
          setNotice(undefined);
        }}
      />
      <PreviewPanel>
        <div className="flex flex-wrap gap-2">
          <PanelButton disabled={!players || list.length >= MAX_PLAYERS} onClick={() => setPlayers([...list, samplePlayer()])}>
            Add a player
          </PanelButton>
          <PanelButton
            disabled={others.length === 0}
            onClick={() => {
              const gone = others[others.length - 1];
              const rest = list.filter((p) => p !== gone);
              // Mirrors the rule: if the host leaves, the next player becomes host.
              setPlayers(gone.isHost ? rest.map((p, i) => ({ ...p, isHost: i === 0 })) : rest);
            }}
          >
            Remove a player
          </PanelButton>
          <PanelButton
            disabled={others.length === 0}
            onClick={() => setPlayers(list.map((p) => (p === others[0] ? { ...p, connected: !p.connected } : p)))}
          >
            Drop or reconnect a player
          </PanelButton>
          <PanelButton disabled={others.length === 0} onClick={() => setHost(iAmHost ? others[0].sessionId : ME)}>
            {iAmHost ? "See it as a non-host" : "Make me the host"}
          </PanelButton>
        </div>
        {notice && <p className="mt-3 font-semibold">{notice}</p>}
      </PreviewPanel>
    </>
  );
}

function PreviewPanel({ children }: { children: ReactNode }) {
  if (!import.meta.env.DEV) return null;
  return (
    <aside aria-label="Preview controls" className="mx-auto mb-6 w-full max-w-md px-4 md:max-w-4xl">
      <details className="rounded-xl border-2 border-dashed border-line bg-paper-deep px-4 py-2">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Preview controls (sample data)</summary>
        <div className="pb-2 pt-1">{children}</div>
      </details>
    </aside>
  );
}

function PanelButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="min-h-11 rounded-lg border-2 border-ink bg-white px-3 font-semibold disabled:cursor-not-allowed disabled:border-line disabled:text-ink-soft"
    />
  );
}
