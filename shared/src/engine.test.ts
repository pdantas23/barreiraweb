import { describe, it, expect } from "vitest";
import { applyMove } from "./engine";
import { initialState } from "./board";
import { adjKey } from "./walls";
import type { GameState, WallSet } from "./types";

const base = (over: Partial<GameState> = {}): GameState => ({ ...initialState(), ...over });

describe("applyMove — peça", () => {
  it("aceita movimento válido, alterna o turno e não muta o estado original", () => {
    const s = initialState();
    const res = applyMove(s, 1, { kind: "piece", to: 67 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.p1).toBe(67);
      expect(res.state.turn).toBe(2);
      expect(res.state.winner).toBeNull();
    }
    // original intacto
    expect(s.p1).toBe(76);
    expect(s.turn).toBe(1);
  });

  it("rejeita movimento inválido de peça", () => {
    const res = applyMove(initialState(), 1, { kind: "piece", to: 58 });
    expect(res).toEqual({ ok: false, error: "invalid-piece-move" });
  });

  it("rejeita jogada fora do turno", () => {
    const res = applyMove(initialState(), 2, { kind: "piece", to: 13 });
    expect(res).toEqual({ ok: false, error: "not-your-turn" });
  });

  it("rejeita qualquer jogada após o fim de jogo", () => {
    const res = applyMove(base({ winner: 1 }), 1, { kind: "piece", to: 67 });
    expect(res).toEqual({ ok: false, error: "game-over" });
  });
});

describe("applyMove — vitória", () => {
  it("detecta vitória do P1 ao entrar na linha 0", () => {
    // P1 em (1,4)=13, P2 longe (8,0=72). Move para (0,4)=4.
    const s = base({ p1: 13, p2: 72, turn: 1 });
    const res = applyMove(s, 1, { kind: "piece", to: 4 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.winner).toBe(1);
  });

  it("detecta vitória do P2 ao entrar na linha 8", () => {
    const s = base({ p1: 40, p2: 67, turn: 2 }); // P2 em (7,4) move pra (8,4)=76; P1 fora da própria linha-gol
    const res = applyMove(s, 2, { kind: "piece", to: 76 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.winner).toBe(2);
  });
});

describe("applyMove — parede", () => {
  it("aceita parede válida: decrementa wallsLeft, carimba owner e alterna turno", () => {
    const s = initialState();
    const res = applyMove(s, 1, { kind: "wall", placement: { type: "h", interRow: 0, interCol: 0 } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.wallsLeft[1]).toBe(9);
      expect(res.state.wallsLeft[2]).toBe(10);
      expect(res.state.turn).toBe(2);
      expect(res.state.walls.placements).toHaveLength(1);
      expect(res.state.walls.placements[0].owner).toBe(1);
    }
    expect(s.wallsLeft[1]).toBe(10); // original intacto
  });

  it("rejeita quando não há paredes restantes", () => {
    const s = base({ wallsLeft: { 1: 0, 2: 10 } });
    const res = applyMove(s, 1, { kind: "wall", placement: { type: "h", interRow: 0, interCol: 0 } });
    expect(res).toEqual({ ok: false, error: "no-walls-left" });
  });

  it("rejeita parede ilegal (cruzamento)", () => {
    const after = applyMove(initialState(), 1, { kind: "wall", placement: { type: "h", interRow: 3, interCol: 3 } });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const res = applyMove(after.state, 2, { kind: "wall", placement: { type: "v", interRow: 3, interCol: 3 } });
    expect(res).toEqual({ ok: false, error: "invalid-wall-placement" });
  });

  it("rejeita parede que fecha totalmente o caminho de um jogador (wall-blocks-goal)", () => {
    // P2 cercado manualmente no índice 40; qualquer parede nova deixa P2 sem caminho.
    const sealed: WallSet = {
      placements: [],
      blockedAdj: new Set([adjKey(40, 31), adjKey(40, 49), adjKey(40, 39), adjKey(40, 41)]),
      occupiedInter: new Set(),
    };
    const s = base({ p1: 76, p2: 40, turn: 1, walls: sealed });
    const res = applyMove(s, 1, { kind: "wall", placement: { type: "h", interRow: 0, interCol: 0 } });
    expect(res).toEqual({ ok: false, error: "wall-blocks-goal" });
  });
});

describe("applyMove — precedência de erros", () => {
  it("game-over vence not-your-turn", () => {
    const res = applyMove(base({ winner: 2, turn: 1 }), 2, { kind: "piece", to: 13 });
    expect(res).toEqual({ ok: false, error: "game-over" });
  });
});
