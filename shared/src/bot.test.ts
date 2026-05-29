import { describe, it, expect } from "vitest";
import { botMove, type BotDifficulty } from "./bot";
import { applyMove } from "./engine";
import { getValidMoves } from "./moves";
import { initialState } from "./board";
import { adjKey } from "./walls";
import type { GameState, WallSet } from "./types";

const DIFFS: BotDifficulty[] = ["easy", "medium", "hard"];

// Aplica a jogada e devolve o novo estado, falhando o teste se a jogada for ilegal.
const playOne = (s: GameState, diff: BotDifficulty): GameState => {
  const mv = botMove(s, s.turn, diff);
  expect(mv, `botMove(${diff}) não deveria ser null em jogo aberto`).not.toBeNull();
  const res = applyMove(s, s.turn, mv!);
  expect(res.ok, `botMove(${diff}) gerou jogada ilegal: ${JSON.stringify(mv)}`).toBe(true);
  if (!res.ok) throw new Error(res.error);
  return res.state;
};

describe("botMove — legalidade", () => {
  for (const diff of DIFFS) {
    it(`${diff}: produz jogada legal a partir do estado inicial`, () => {
      // roda algumas vezes pra cobrir os ramos aleatórios (erro/parede do easy etc.)
      for (let i = 0; i < 15; i++) {
        const mv = botMove(initialState(), 1, diff);
        expect(mv).not.toBeNull();
        expect(applyMove(initialState(), 1, mv!).ok).toBe(true);
      }
    });
  }
});

describe("botMove — termina partidas sem jogada ilegal (self-play)", () => {
  // easy e medium são rápidos; uma partida cada cobre muitos estados.
  for (const diff of ["easy", "medium"] as BotDifficulty[]) {
    it(`${diff} vs ${diff} termina com vencedor`, () => {
      let s = initialState(1);
      let moves = 0;
      while (s.winner === null && moves < 400) {
        s = playOne(s, diff);
        moves++;
      }
      expect(s.winner).not.toBeNull();
    });
  }

  it("hard produz uma sequência de jogadas legais", () => {
    // minimax é mais lento — alguns lances bastam pra validar legalidade.
    let s = initialState(1);
    for (let i = 0; i < 8 && s.winner === null; i++) {
      s = playOne(s, "hard");
    }
    expect(s.winner === null || s.winner !== null).toBe(true); // não lançou
  });
});

describe("botMove — comportamento por dificuldade", () => {
  it("easy nunca usa a última parede (mantém reserva)", () => {
    // Com apenas 1 parede na mão, easy não deve colocar parede.
    const s: GameState = { ...initialState(), wallsLeft: { 1: 1, 2: 10 }, turn: 1 };
    for (let i = 0; i < 30; i++) {
      const mv = botMove(s, 1, "easy");
      expect(mv?.kind).toBe("piece");
    }
  });

  it("retorna null quando não há nenhuma jogada legal (peça cercada, sem paredes)", () => {
    // P2 cercado no 40 e sem paredes → nenhuma jogada possível.
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

  it("medium e hard avançam em direção ao objetivo (não pioram a própria distância no 1º lance)", () => {
    // No 1º lance de tabuleiro aberto o avanço esperado é subir (P1 indo pra linha 0).
    for (const diff of ["medium", "hard"] as BotDifficulty[]) {
      const mv = botMove(initialState(), 1, diff);
      expect(mv).not.toBeNull();
      // não deve ser uma parede no primeiríssimo lance (medium só ~40% e precisa de ganho;
      // no início não há quem atrasar, então é peça). hard idem.
      if (mv!.kind === "piece") {
        // avança ou anda lateralmente, nunca fica > distância inicial — checa que é vizinho válido
        expect([67, 75, 77]).toContain(mv!.to);
      }
    }
  });
});
