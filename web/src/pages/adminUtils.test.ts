import { describe, it, expect, beforeEach, vi } from "vitest";
import { rangeOf, loadPeriod, toCsv, todayIso, PERIOD_LS, type PeriodState } from "./adminUtils";

const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);

describe("adminUtils — rangeOf (filtro de período)", () => {
  const mk = (key: PeriodState["key"]): PeriodState => ({ key, from: "2020-01-01", to: "2020-12-31" });

  it("Hoje: from = to = hoje", () => {
    const r = rangeOf(mk("today"));
    expect(r.from).toBe(todayIso());
    expect(r.to).toBe(todayIso());
    expect(daysBetween(r.from, r.to)).toBe(0);
  });

  it("7 dias: range de 6 dias terminando hoje", () => {
    const r = rangeOf(mk("7d"));
    expect(r.to).toBe(todayIso());
    expect(daysBetween(r.from, r.to)).toBe(6);
  });

  it("30 dias: 29 dias até hoje", () => {
    const r = rangeOf(mk("30d"));
    expect(r.to).toBe(todayIso());
    expect(daysBetween(r.from, r.to)).toBe(29);
  });

  it("90 dias: 89 dias até hoje", () => {
    const r = rangeOf(mk("90d"));
    expect(daysBetween(r.from, r.to)).toBe(89);
  });

  it("Personalizado: passa from/to direto", () => {
    const r = rangeOf({ key: "custom", from: "2026-03-01", to: "2026-03-15" });
    expect(r).toEqual({ from: "2026-03-01", to: "2026-03-15" });
  });
});

describe("adminUtils — loadPeriod (persistência)", () => {
  // jsdom desta config não expõe localStorage — stub manual (igual Home.test).
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    });
  });

  it("default é 30 dias quando não há nada salvo", () => {
    const p = loadPeriod();
    expect(p.key).toBe("30d");
    expect(daysBetween(p.from, p.to)).toBe(29);
  });

  it("lê o período salvo no localStorage", () => {
    const saved: PeriodState = { key: "custom", from: "2026-02-01", to: "2026-02-10" };
    localStorage.setItem(PERIOD_LS, JSON.stringify(saved));
    expect(loadPeriod()).toEqual(saved);
  });

  it("JSON inválido cai no default sem quebrar", () => {
    localStorage.setItem(PERIOD_LS, "não é json");
    expect(loadPeriod().key).toBe("30d");
  });
});

describe("adminUtils — toCsv (export)", () => {
  it("array vazio → string vazia", () => {
    expect(toCsv([])).toBe("");
  });

  it("cabeçalho + linhas a partir das chaves do 1º objeto", () => {
    expect(toCsv([{ a: 1, b: "x" }, { a: 2, b: "y" }])).toBe("a,b\n1,x\n2,y");
  });

  it("null/undefined viram célula vazia", () => {
    expect(toCsv([{ a: null, b: undefined }])).toBe("a,b\n,");
  });

  it("escapa vírgula, aspas e quebra de linha", () => {
    const csv = toCsv([{ nome: "Silva, João", obs: 'diz "oi"', multi: "linha1\nlinha2" }]);
    const linhas = csv.split("\n");
    expect(linhas[0]).toBe("nome,obs,multi");
    // valor com vírgula é aspeado; aspas internas dobradas; quebra de linha aspeada
    expect(csv).toContain('"Silva, João"');
    expect(csv).toContain('"diz ""oi"""');
    expect(csv).toContain('"linha1\nlinha2"');
  });
});
