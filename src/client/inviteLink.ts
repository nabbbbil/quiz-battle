import { ROOM_CODE_LENGTH } from "../shared/rules";

/** The room code from a share link like `/?room=KTPQ`, or "" if it's missing or malformed. */
export function readInviteCode(search = location.search): string {
  const code = new URLSearchParams(search).get("room")?.trim().toUpperCase() ?? "";
  return new RegExp(`^[A-Z]{${ROOM_CODE_LENGTH}}$`).test(code) ? code : "";
}

export function inviteUrl(code: string): string {
  return `${location.origin}${location.pathname}?room=${code}`;
}
