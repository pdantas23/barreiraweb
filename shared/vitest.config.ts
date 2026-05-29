import { defineConfig } from "vitest/config";

// Engine pura — roda em ambiente node, sem DOM. globals=true pra usar
// describe/it/expect sem import explícito.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
