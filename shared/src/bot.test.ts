import { describe, it, expect } from "vitest";
import { botMove, type BotDifficulty } from "./bot";
import { applyMove } from "./engine";
import { getValidMoves } from "./moves";
import { initialState } from "./board";
import { adjKey } from "./walls";
import type { GameState, Move, WallSet } from "./types";

const DIFFS: BotDifficulty[] = ["easy", "medium", "hard"];

// Joga uma partida bot-vs-bot e devolve resumo. Falha se gerar jogada ilegal.
const selfPlay = (d1: BotDifficulty, d2: BotDifficulty, cap = 400) => {
  let s = initialState(1);
  let walls = 0;
  let moves = 0;
  while (s.winner === null && moves < cap) {
    const mv = botMove(s, s.turn, s.turn === 1 ? d1 : d2);
    expect(mv, "botMove não deveria ser null em jogo aberto").not.toBeNull();
    const res = applyMove(s, s.turn, mv as Move);
    expect(res.ok, `jogada ilegal: ${JSON.stringify(mv)}`).toBe(true);
    if (!res.ok) throw new Error(res.error);
    if ((mv as Move).kind === "wall") walls++;
    s = res.state;
    moves++;
  }
  return { winner: s.winner, walls, moves };
};

describe("botMove — determinístico (zero aleatoriedade)", () => {
  for (const diff of DIFFS) {
    it(`${diff}: mesma posição → sempre a mesma jogada`, () => {
      const first = botMove(initialState(), 1, diff);
      expect(first).not.toBeNull();
      // Legal.
      expect(applyMove(initialState(), 1, first as Move).ok).toBe(true);
      // Repetir não muda a decisão (não há Math.random no caminho).
      for (let i = 0; i < 5; i++) {
        expect(botMove(initialState(), 1, diff)).toEqual(first);
      }
    });
  }

  it("os 3 níveis avançam no 1º lance do tabuleiro aberto (peça → 67)", () => {
    // De 76 (8,4), subir pra 67 (7,4) reduz mais a distância BFS — minimax
    // prefere avançar a colocar parede no início. Determinístico em todos.
    for (const diff of DIFFS) {
      expect(botMove(initialState(), 1, diff)).toEqual({ kind: "piece", to: 67 });
    }
  });
});

describe("botMove — minimax decide", () => {
  it("todos os níveis pegam a vitória imediata disponível", () => {
    // P1 a um passo do gol: de 13 (1,4) → 4 (0,4) vence na hora.
    const s: GameState = { ...initialState(), p1: 13, p2: 36, turn: 1 };
    for (const diff of DIFFS) {
      expect(botMove(s, 1, diff)).toEqual({ kind: "piece", to: 4 });
    }
  });

  it("médio e difícil USAM paredes ao longo da partida (quando o minimax indica)", () => {
    expect(selfPlay("medium", "medium").walls).toBeGreaterThan(0);
    expect(selfPlay("hard", "hard").walls).toBeGreaterThan(0);
  }, 20_000);

  it("retorna null quando não há nenhuma jogada legal (peça cercada, sem paredes)", () => {
    const sealed: WallSet = {
      placements: [],
      blockedAdj: new Set([adjKey(40, 31), adjKey(40, 49), adjKey(40, 39), adjKey(40, 41)]),
      occupiedInter: new Set(),
    };
    const s: GameState = { p1: 76, p2: 40, turn: 2, walls: sealed, wallsLeft: { 1: 10, 2: 0 }, winner: null };
    expect(getValidMoves(s, 2)).toEqual([]);
    for (const diff of DIFFS) {
      expect(botMove(s, 2, diff)).toBeNull();
    }
  });
});

describe("botMove — partidas terminam e força cresce com a profundidade", () => {
  it("easy vs easy termina com vencedor", () => {
    expect(selfPlay("easy", "easy").winner).not.toBeNull();
  });

  it("medium vs medium termina com vencedor", () => {
    expect(selfPlay("medium", "medium").winner).not.toBeNull();
  }, 20_000);

  it("difícil (profundidade maior) vence o fácil", () => {
    // Determinístico: P1=hard, P2=easy, primeiro turno fixo.
    expect(selfPlay("hard", "easy").winner).toBe(1);
  }, 20_000);
});
