import { describe, it, expect } from "vitest";
import { msUntilNextRun } from "./reengagement.js";

const H = 3_600_000;

describe("msUntilNextRun (18h BRT = 21h UTC)", () => {
  it("agenda pra hoje se ainda não passou o horário", () => {
    // 2026-06-03T10:00:00Z → faltam 11h pro 21:00Z.
    const now = Date.parse("2026-06-03T10:00:00Z");
    expect(msUntilNextRun(now, 21)).toBe(11 * H);
  });

  it("agenda pra amanhã se o horário já passou", () => {
    // 2026-06-03T22:00:00Z → próximo 21:00Z é amanhã (23h depois).
    const now = Date.parse("2026-06-03T22:00:00Z");
    expect(msUntilNextRun(now, 21)).toBe(23 * H);
  });

  it("sempre devolve um valor positivo dentro de 24h", () => {
    const now = Date.parse("2026-06-03T21:00:00.001Z"); // logo após o alvo
    const ms = msUntilNextRun(now, 21);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * H);
  });
});
