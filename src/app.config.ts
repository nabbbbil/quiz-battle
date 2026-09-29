import {
  defineServer,
  defineRoom,
  monitor,
  playground,
  createRouter,
  createEndpoint,
  matchMaker,
} from "colyseus";

import { QuizRoom } from "./rooms/QuizRoom.js";

// Which websites may call this server from a browser. On Render, ALLOWED_ORIGINS
// holds the Vercel address(es), comma-separated. localhost is always allowed so
// a local build can be tested against the live server. In development every
// origin is allowed, so phones on the same Wi-Fi can connect.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

if (process.env.NODE_ENV === "production") {
  matchMaker.controller.getCorsHeaders = (headers) => {
    const origin = headers.get("origin") ?? "";
    const allowed = allowedOrigins.includes(origin) || LOCALHOST.test(origin);
    return {
      // Echo the origin only when it's allowed. Any other site gets a value that
      // doesn't match its own, so the browser refuses to let it use the response.
      "Access-Control-Allow-Origin": allowed ? origin : (allowedOrigins[0] ?? "null"),
      Vary: "Origin",
    };
  };
}

const server = defineServer({
  rooms: {
    quiz_room: defineRoom(QuizRoom),
  },

  routes: createRouter({
    // Render checks this to know the server is up, and the client polls it to
    // show "Waking up the game server" while a sleeping free instance starts.
    health: createEndpoint("/health", { method: "GET" }, async () => {
      return { ok: true };
    }),
  }),

  express: (app) => {
    // Debug tools, never exposed in production.
    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
      app.use("/playground", playground());
    }
  },
});

export default server;

/** Named export read by the `colyseus/vite` plugin's `serverEntry`. */
export { server };
