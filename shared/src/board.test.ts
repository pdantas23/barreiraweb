import { describe, it, expect } from "vitest";
import {
  BOARD_SIZE,
  TOTAL_SQUARES,
  INITIAL_P1,
  INITIAL_P2,
  WALLS_PER_PLAYER,
  at,
  row,
  col,
  inBounds,
  goalRow,
  opponentOf,
  piecePosition,
  initialState,
  randomFirstTurn,
} from "./board";

describe("board — constantes e coordenadas", () => {
  it("tabuleiro é 9x9 = 81 casas", () => {
    expect(BOARD_SIZE).toBe(9);
    expect(TOTAL_SQUARES).toBe(81);
  });

  it("posições iniciais: P1 embaixo (8,4)=76, P2 em cima (0,4)=4", () => {
    expect(INITIAL_P1).toBe(76);
    expect(INITIAL_P2).toBe(4);
    expect(row(76)).toBe(8);
    expect(col(76)).toBe(4);
    expect(row(4)).toBe(0);
    expect(col(4)).toBe(4);
  });

  it("at/row/col são inversos", () => {
    for (const idx of [0, 4, 40, 76, 80]) {
      expect(at(row(idx), col(idx))).toBe(idx);
    }
  });

  it("inBounds rejeita fora do tabuleiro", () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(8, 8)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(0, 9)).toBe(false);
    expect(inBounds(9, 0)).toBe(false);
  });

  it("goalRow: P1 → linha 0, P2 → linha 8", () => {
    expect(goalRow(1)).toBe(0);
    expect(goalRow(2)).toBe(8);
  });

  it("opponentOf alterna", () => {
    expect(opponentOf(1)).toBe(2);
    expect(opponentOf(2)).toBe(1);
  });
});

describe("board — initialState", () => {
  it("estado inicial padrão começa com turn=1", () => {
    const s = initialState();
    expect(s.p1).toBe(76);
    expect(s.p2).toBe(4);
    expect(s.turn).toBe(1);
    expect(s.winner).toBeNull();
    expect(s.wallsLeft).toEqual({ 1: WALLS_PER_PLAYER, 2: WALLS_PER_PLAYER });
    expect(s.walls.placements).toEqual([]);
    expect(s.walls.blockedAdj.size).toBe(0);
    expect(s.walls.occupiedInter.size).toBe(0);
  });

  it("respeita firstTurn passado", () => {
    expect(initialState(2).turn).toBe(2);
    expect(initialState(1).turn).toBe(1);
  });

  it("cada chamada cria walls independentes (sem alias de Set)", () => {
    const a = initialState();
    const b = initialState();
    expect(a.walls.blockedAdj).not.toBe(b.walls.blockedAdj);
  });

  it("piecePosition lê a peça certa", () => {
    const s = initialState();
    expect(piecePosition(s, 1)).toBe(76);
    expect(piecePosition(s, 2)).toBe(4);
  });
});

describe("board — randomFirstTurn", () => {
  it("sempre retorna 1 ou 2", () => {
    for (let i = 0; i < 50; i++) {
      expect([1, 2]).toContain(randomFirstTurn());
    }
  });
});
