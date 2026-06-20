import { describe, it, expect } from "vitest";
import { BOT_NAMES, getRandomBotName } from "./botNames";

describe("botNames", () => {
  it("tem pelo menos 80 nomes", () => {
    expect(BOT_NAMES.length).toBeGreaterThanOrEqual(80);
  });

  it("getRandomBotName devolve um nome da lista", () => {
    for (let i = 0; i < 50; i++) {
      expect(BOT_NAMES).toContain(getRandomBotName());
    }
  });

  it("não repete um nome já em uso (taken)", () => {
    const taken = new Set<string>();
    // Pega tantos nomes únicos quanto a lista tem — cada um deve ser novo.
    for (let i = 0; i < BOT_NAMES.length; i++) {
      const name = getRandomBotName(taken);
      expect(taken.has(name)).toBe(false);
      taken.add(name);
    }
    expect(taken.size).toBe(BOT_NAMES.length);
  });

  it("quando todos estão ocupados, gera nome único com sufixo", () => {
    const taken = new Set<string>(BOT_NAMES);
    const name = getRandomBotName(taken);
    expect(taken.has(name)).toBe(false);
    // É um nome-base + sufixo numérico.
    expect(name).toMatch(/\d$/);
  });
});
