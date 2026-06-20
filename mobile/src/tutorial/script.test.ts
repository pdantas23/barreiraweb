import {
  applyMove,
  getValidMoves,
  initialState,
  row,
  type GameState,
} from "@barreira/shared";
import {
  TUTORIAL_HUMAN,
  TUTORIAL_OPPONENT,
  TUTORIAL_STEPS,
  allowedTargets,
  scriptedOpponentMove,
} from "./script";

describe("tutorial/script — integridade do roteiro", () => {
  it("começa com info, termina com info que tem CTA", () => {
    expect(TUTORIAL_STEPS[0].kind).toBe("info");
    const last = TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1];
    expect(last.kind).toBe("info");
    expect(last.cta).toBeTruthy();
  });

  it("tem exatamente um passo de mover e um de parede", () => {
    expect(TUTORIAL_STEPS.filter((s) => s.kind === "move")).toHaveLength(1);
    expect(TUTORIAL_STEPS.filter((s) => s.kind === "wall")).toHaveLength(1);
  });

  it("todo passo tem texto; todo info tem cta; o move tem targets", () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.text.length).toBeGreaterThan(0);
      if (s.kind === "info") expect(s.cta).toBeTruthy();
      if (s.kind === "move") expect(s.targets && s.targets.length).toBeGreaterThan(0);
    }
  });
});

describe("tutorial/script — allowedTargets", () => {
  it("no passo de mover, devolve só alvos que são lances válidos", () => {
    const state = initialState(TUTORIAL_HUMAN);
    const moveStep = TUTORIAL_STEPS.find((s) => s.kind === "move")!;
    const targets = allowedTargets(state, moveStep);
    expect(targets.length).toBeGreaterThan(0);
    const valid = new Set(getValidMoves(state, TUTORIAL_HUMAN));
    for (const t of targets) expect(valid.has(t)).toBe(true);
  });

  it("filtra alvo ilegal (defensivo)", () => {
    const state = initialState(TUTORIAL_HUMAN);
    const bogus = { id: "x", kind: "move" as const, text: "t", targets: [0] };
    expect(allowedTargets(state, bogus)).toEqual([]);
  });

  it("devolve vazio fora de um passo de mover", () => {
    const state = initialState(TUTORIAL_HUMAN);
    const info = TUTORIAL_STEPS.find((s) => s.kind === "info")!;
    expect(allowedTargets(state, info)).toEqual([]);
  });
});

describe("tutorial/script — scriptedOpponentMove", () => {
  it("devolve um lance que avança o oponente rumo ao objetivo (linha de baixo)", () => {
    const state = initialState(TUTORIAL_OPPONENT); // vez do oponente
    const move = scriptedOpponentMove(state);
    expect(move).not.toBeNull();
    expect(move!.kind).toBe("piece");
    // O oponente nasce na linha 0; o lance preferido o aproxima da linha 8.
    const before = row(state.p2);
    const dest = (move as { kind: "piece"; to: number }).to;
    expect(row(dest)).toBeGreaterThan(before);
  });

  it("o lance scriptado é aceito pela engine real", () => {
    const state = initialState(TUTORIAL_OPPONENT);
    const move = scriptedOpponentMove(state)!;
    const res = applyMove(state, TUTORIAL_OPPONENT, move);
    expect(res.ok).toBe(true);
  });
});

describe("tutorial/script — fluxo guiado aplica sem erro", () => {
  it("humano move → oponente responde → vez volta pro humano", () => {
    let state: GameState = initialState(TUTORIAL_HUMAN);
    const moveStep = TUTORIAL_STEPS.find((s) => s.kind === "move")!;
    const target = allowedTargets(state, moveStep)[0];

    const humanRes = applyMove(state, TUTORIAL_HUMAN, { kind: "piece", to: target });
    expect(humanRes.ok).toBe(true);
    state = (humanRes as { ok: true; state: GameState }).state;
    expect(state.turn).toBe(TUTORIAL_OPPONENT);

    const oppRes = applyMove(state, TUTORIAL_OPPONENT, scriptedOpponentMove(state)!);
    expect(oppRes.ok).toBe(true);
    state = (oppRes as { ok: true; state: GameState }).state;
    expect(state.turn).toBe(TUTORIAL_HUMAN);
  });
});
