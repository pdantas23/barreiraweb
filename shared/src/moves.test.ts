import { describe, it, expect } from "vitest";
import { getValidMoves, isValidPieceMove } from "./moves";
import { initialState, registerWall } from "./index";
import type { GameState } from "./types";
import { createEmptyWalls } from "./walls";

const base = (over: Partial<GameState> = {}): GameState => ({
  ...initialState(),
  ...over,
});

describe("getValidMoves — passos ortogonais", () => {
  it("P1 no início (76) pode subir/esquerda/direita, não descer (borda)", () => {
    const moves = getValidMoves(initialState(), 1);
    expect(moves.sort((a, b) => a - b)).toEqual([67, 75, 77]);
  });

  it("P2 no início (4) pode descer/esquerda/direita", () => {
    const moves = getValidMoves(initialState(), 2);
    expect(moves.sort((a, b) => a - b)).toEqual([3, 5, 13]);
  });

  it("retorna [] se já há vencedor", () => {
    expect(getValidMoves(base({ winner: 1 }), 1)).toEqual([]);
  });

  it("não atravessa parede", () => {
    // bloqueia 76-67 (subida do P1) com h(7,4)
    const s = base({ walls: registerWall(createEmptyWalls(), { type: "h", interRow: 7, interCol: 4 }) });
    const moves = getValidMoves(s, 1);
    expect(moves).not.toContain(67);
    expect(moves.sort((a, b) => a - b)).toEqual([75, 77]);
  });
});

describe("getValidMoves — salto sobre adversário", () => {
  it("salto reto quando o adversário está adjacente e há espaço atrás", () => {
    // P1 em (4,4)=40, P2 em (3,4)=31 (acima). Salto reto para (2,4)=22.
    const s = base({ p1: 40, p2: 31, turn: 1 });
    const moves = getValidMoves(s, 1);
    expect(moves).toContain(22); // pulou por cima
    expect(moves).not.toContain(31); // não pode parar em cima do oponente
  });

  it("saltos diagonais quando o salto reto está bloqueado pela borda", () => {
    // P1 em (1,4)=13, P2 em (0,4)=4 (acima, na borda). Salto reto sairia do tabuleiro
    // → oferece diagonais (0,3)=3 e (0,5)=5.
    const s = base({ p1: 13, p2: 4, turn: 1 });
    const moves = getValidMoves(s, 1);
    expect(moves).not.toContain(4);
    expect(moves).toContain(3);
    expect(moves).toContain(5);
  });

  it("saltos diagonais quando há parede atrás do adversário", () => {
    // P1 (4,4)=40, P2 (3,4)=31. Parede atrás do P2 bloqueia 31-22 → diagonais 30 e 32.
    const walls = registerWall(createEmptyWalls(), { type: "h", interRow: 2, interCol: 4 }); // bloqueia 22-31
    const s = base({ p1: 40, p2: 31, turn: 1, walls });
    const moves = getValidMoves(s, 1);
    expect(moves).not.toContain(22); // salto reto bloqueado
    expect(moves).toContain(30); // (3,3)
    expect(moves).toContain(32); // (3,5)
  });
});

describe("isValidPieceMove", () => {
  it("aceita destino válido, rejeita inválido", () => {
    const s = initialState();
    expect(isValidPieceMove(s, 1, 67)).toBe(true);
    expect(isValidPieceMove(s, 1, 58)).toBe(false); // 2 casas acima, não-adjacente
    expect(isValidPieceMove(s, 1, 40)).toBe(false); // longe
  });
});
