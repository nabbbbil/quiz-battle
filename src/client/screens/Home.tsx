import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "../ui/Button";
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from "../../shared/rules";
import { AGE_GROUPS, DEFAULT_AGE_GROUP, type AgeGroup } from "../../shared/ageGroups";
import type { ServerStatus } from "../useServerStatus";

export type HomeBusy = "create" | "join" | null;

interface HomeProps {
  /** Code from a share link. When set, joining becomes the main action. */
  initialCode?: string;
  /** The nickname used last time, so leaving a room doesn't make the player retype it. */
  initialName?: string;
  /** The age group picked last time. */
  initialAgeGroup?: AgeGroup;
  busy: HomeBusy;
  /** Whether the game server has answered yet. Create and Join wait for it. */
  serverStatus: ServerStatus;
  onRetryServer: () => void;
  /** Why the last create or join failed, in plain words. */
  error?: string;
  onCreate: (name: string, ageGroup: AgeGroup) => void;
  onJoin: (code: string, name: string) => void;
}

export function Home({
  initialCode = "",
  initialName = "",
  initialAgeGroup = DEFAULT_AGE_GROUP,
  busy,
  serverStatus,
  onRetryServer,
  error,
  onCreate,
  onJoin,
}: HomeProps) {
  const [name, setName] = useState(initialName);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(initialAgeGroup);
  const [code, setCode] = useState(initialCode);
  const [nameError, setNameError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const invited = initialCode !== "";
  // "checking" isn't blocked: an awake server answers in a blink, so no flash of disabled buttons.
  const serverDown = serverStatus === "waking" || serverStatus === "unreachable";

  function validName(): string | null {
    const trimmed = name.trim();
    setNameError(trimmed ? undefined : "Type a nickname first.");
    return trimmed || null;
  }

  function create() {
    if (busy || serverDown) return;
    setCodeError(undefined);
    const trimmed = validName();
    if (trimmed) onCreate(trimmed, ageGroup);
    else nameRef.current?.focus();
  }

  function join() {
    if (busy || serverDown) return;
    const trimmed = validName();
    const codeOk = code.length === ROOM_CODE_LENGTH;
    setCodeError(codeOk ? undefined : `Room codes are ${ROOM_CODE_LENGTH} letters.`);
    if (!trimmed) nameRef.current?.focus();
    else if (!codeOk) codeRef.current?.focus();
    else onJoin(code, trimmed);
  }

  // Enter in the nickname field runs the form's first button: Create, or Join
  // when the player came from an invite link.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value ?? (invited ? "join" : "create");
    if (intent === "join") join();
    else create();
  }

  function handleCodeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      join();
    }
  }

  const joinSection = (
    <section aria-labelledby="join-heading">
      <h2 id="join-heading" className="text-xl font-semibold">
        {invited ? "Join your friend's room" : "Got a room code?"}
      </h2>
      <label htmlFor="room-code" className="mt-3 block font-semibold">
        Room code
      </label>
      <div className="mt-2 flex gap-3">
        <input
          ref={codeRef}
          id="room-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, ROOM_CODE_LENGTH));
            setCodeError(undefined);
          }}
          onKeyDown={handleCodeKeyDown}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={codeError ? true : undefined}
          aria-describedby={codeError ? "room-code-error" : undefined}
          // Wide tracking because a code is read out one letter at a time. The
          // matching indent re-centers it (tracking adds space after the last letter).
          className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-3 indent-[0.3em] text-center font-display text-2xl font-semibold tracking-[0.3em] focus:border-ink aria-invalid:border-red-deep"
        />
        <Button
          type="submit"
          name="intent"
          value="join"
          variant={invited ? "primary" : "secondary"}
          busy={busy === "join"}
          disabled={busy === "create" || serverDown}
        >
          {busy === "join" ? "Joining…" : "Join"}
        </Button>
      </div>
      {codeError && (
        <p id="room-code-error" className="mt-2 font-semibold text-red-deep">
          {codeError}
        </p>
      )}
    </section>
  );

  const createSection = (
    <section aria-labelledby={invited ? "create-heading" : undefined} className="flex flex-col gap-4">
      {invited && (
        <h2 id="create-heading" className="text-xl font-semibold">
          Or start your own room
        </h2>
      )}
      {/* A compact switch rather than three cards, so joiners (most players)
          don't scroll past a choice that isn't theirs. */}
      <fieldset aria-describedby="age-topics">
        <legend className="font-semibold">Players' age</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {AGE_GROUPS.map((g) => (
            <label
              key={g.id}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-line bg-white font-display text-lg font-semibold has-checked:border-ink has-checked:bg-ink has-checked:text-white has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-ink"
            >
              <input
                type="radio"
                name="age-group"
                value={g.id}
                checked={ageGroup === g.id}
                onChange={() => setAgeGroup(g.id)}
                aria-label={g.label}
                className="sr-only"
              />
              {g.label.replace("Ages ", "")}
            </label>
          ))}
        </div>
        <p id="age-topics" className="mt-2 text-sm text-ink-soft">
          {AGE_GROUPS.find((g) => g.id === ageGroup)!.topics}.
        </p>
      </fieldset>
      <Button
        type="submit"
        name="intent"
        value="create"
        variant={invited ? "secondary" : "primary"}
        busy={busy === "create"}
        disabled={busy === "join" || serverDown}
        className="w-full"
      >
        {busy === "create" ? "Creating room…" : "Create a room"}
      </Button>
    </section>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-10 sm:pt-20">
      <header>
        <h1 className="text-5xl font-semibold">Quiz Battle</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Race your friends through 10 math questions, each on your own phone. Faster right answers score more.
        </p>
      </header>

      <form noValidate onSubmit={handleSubmit} aria-busy={busy !== null} className="mt-8 flex flex-col gap-8">
        {serverStatus === "waking" && (
          <div role="status" className="rounded-xl border-2 border-ink bg-paper-deep px-4 py-3">
            <p className="font-semibold">Waking up the game server…</p>
            <p>It sleeps when nobody's playing. This can take up to a minute. Create and Join turn on when it's ready.</p>
          </div>
        )}
        {serverStatus === "unreachable" && (
          <div role="alert" className="rounded-xl border-2 border-red-deep bg-red-tint px-4 py-3 text-red-deep">
            <p className="font-semibold">The game server isn't answering.</p>
            <p>Check your internet connection, then try again.</p>
            <Button onClick={onRetryServer} className="mt-3">
              Try again
            </Button>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-xl border-2 border-red-deep bg-red-tint px-4 py-3 text-red-deep">
            <p className="font-semibold">That didn't work.</p>
            <p>{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="nickname" className="block font-semibold">
            Your nickname
          </label>
          <p id="nickname-hint" className="text-sm text-ink-soft">
            Up to {NAME_MAX_LENGTH} characters. Everyone in the room sees it.
          </p>
          <input
            ref={nameRef}
            id="nickname"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(undefined);
            }}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="nickname"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "nickname-hint nickname-error" : "nickname-hint"}
            className="mt-2 min-h-12 w-full rounded-xl border-2 border-line bg-white px-4 text-lg focus:border-ink aria-invalid:border-red-deep"
          />
          {nameError && (
            <p id="nickname-error" className="mt-2 font-semibold text-red-deep">
              {nameError}
            </p>
          )}
        </div>

        {invited ? (
          <>
            {joinSection}
            {createSection}
          </>
        ) : (
          <>
            {createSection}
            {joinSection}
          </>
        )}
      </form>
    </main>
  );
}
