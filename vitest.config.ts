import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so the colyseus/vite plugin doesn't boot a dev
// server during tests. Room tests boot their own with @colyseus/testing.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 15000,
  },
});
