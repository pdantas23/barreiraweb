import { defineConfig } from "@playwright/test";

// Testes visuais (screenshot) do lobby/leaderboard/deep link. Rodam contra o
// dev server do Vite (localhost:5173) — fora do CI, só local:
//   npm run test:e2e                     # compara com os baselines
//   npm run test:e2e -- --update-snapshots   # (re)gera os baselines
//
// Baselines ficam em web/e2e/snapshots/. São específicos de plataforma —
// gere-os na mesma máquina/SO em que vai validar.
export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/snapshots/{testFileName}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    // Mata animações CSS pra screenshot estável.
    // (definido também por toHaveScreenshot abaixo)
  },
  expect: {
    // Falha se a diferença passar de 0.1% dos pixels.
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled" },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
