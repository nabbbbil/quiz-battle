import { ColyseusSDK } from "@colyseus/sdk";
import type { server } from "../app.config";

// In dev, Vite serves the client and the game server on the same port, so the
// page's own host is the server. In production the client (Vercel) and server
// (Render) are on different hosts, and VITE_SERVER_URL points at the server.
const endpoint =
  import.meta.env.VITE_SERVER_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;

// `typeof server` types the room names, message types and HTTP routes end to
// end, so a typo in a room name is a compile error rather than a runtime one.
export const client = new ColyseusSDK<typeof server>(endpoint);
