import { describe, it, expect } from "vitest";
import {
  adjKey,
  createEmptyWalls,
  canPlaceWall,
  registerWall,
  isBlocked,
  neighbors,
  hasPathToRow,
  allPossiblePlacements,
} from "./walls";
import type { WallPlacement, WallSet } from "./types";

const h = (interRow: number, interCol: number): WallPlacement => ({ type: "h", interRow, interCol });
const v = (interRow: number, interCol: number): WallPlacement => ({ type: "v", interRow, interCol });

describe("adjKey", () => {
  it("normaliza ordem (a,b) === (b,a)", () => {
    expect(adjKey(9, 0)).toBe("0-9");
    expect(adjKey(0, 9)).toBe("0-9");
  });
});

describe("canPlaceWall", () => {
  it("aceita parede válida no tabuleiro vazio", () => {
    const w = createEmptyWalls();
    expect(canPlaceWall(w, h(0, 0))).toBe(true);
    expect(canPlaceWall(w, v(4, 4))).toBe(true);
  });

  it("rejeita intersecção fora de [0, BOARD_SIZE-2]", () => {
    const w = createEmptyWalls();
    expect(canPlaceWall(w, h(8, 0))).toBe(false); // interRow 8 > 7
    expect(canPlaceWall(w, v(0, 8))).toBe(false); // interCol 8 > 7
    expect(canPlaceWall(w, h(-1, 0))).toBe(false);
  });

  it("rejeita cruzamento H/V na mesma intersecção", () => {
    const w = registerWall(createEmptyWalls(), h(3, 3));
    expect(canPlaceWall(w, v(3, 3))).toBe(false);
  });

  it("rejeita sobreposição de paredes paralelas (compartilham adjacência)", () => {
    const w = registerWall(createEmptyWalls(), h(0, 0));
    // h(0,1) compartilha a adjacência 1-10 com h(0,0)
    expect(canPlaceWall(w, h(0, 1))).toBe(false);
  });

  it("aceita paredes paralelas distantes (sem adjacência compartilhada)", () => {
    const w = registerWall(createEmptyWalls(), h(0, 0));
    expect(canPlaceWall(w, h(0, 2))).toBe(true);
  });
});

describe("registerWall", () => {
  it("retorna NOVO WallSet (imutável) e não muta o original", () => {
    const w0 = createEmptyWalls();
    const w1 = registerWall(w0, h(0, 0));
    expect(w1).not.toBe(w0);
    expect(w0.placements).toHaveLength(0);
    expect(w0.blockedAdj.size).toBe(0);
    expect(w1.placements).toHaveLength(1);
  });

  it("h(0,0) bloqueia as adjacências verticais 0-9 e 1-10", () => {
    const w = registerWall(createEmptyWalls(), h(0, 0));
    expect(isBlocked(w, 0, 9)).toBe(true);
    expect(isBlocked(w, 1, 10)).toBe(true);
    expect(isBlocked(w, 2, 11)).toBe(false);
  });

  it("v(0,0) bloqueia as adjacências horizontais 0-1 e 9-10", () => {
    const w = registerWall(createEmptyWalls(), v(0, 0));
    expect(isBlocked(w, 0, 1)).toBe(true);
    expect(isBlocked(w, 9, 10)).toBe(true);
  });

  it("no-op silencioso em placement fora de range (retorna o mesmo WallSet)", () => {
    const w0 = createEmptyWalls();
    const w1 = registerWall(w0, h(99, 99));
    expect(w1).toBe(w0);
  });
});

describe("neighbors", () => {
  it("4 vizinhos no centro, sem paredes", () => {
    const w = createEmptyWalls();
    expect(neighbors(w, 40).sort((a, b) => a - b)).toEqual([31, 39, 41, 49]);
  });

  it("borda tem menos vizinhos", () => {
    const w = createEmptyWalls();
    // índice 0 = (0,0): só direita (1) e baixo (9)
    expect(neighbors(w, 0).sort((a, b) => a - b)).toEqual([1, 9]);
  });

  it("parede remove o vizinho bloqueado", () => {
    const w = registerWall(createEmptyWalls(), h(0, 0)); // bloqueia 0-9
    expect(neighbors(w, 0)).toEqual([1]); // baixo (9) bloqueado, só sobra direita
  });
});

describe("hasPathToRow", () => {
  it("true imediato quando já está na linha-alvo", () => {
    expect(hasPathToRow(createEmptyWalls(), 4, 0)).toBe(true);
  });

  it("true no tabuleiro aberto (76 alcança linha 0)", () => {
    expect(hasPathToRow(createEmptyWalls(), 76, 0)).toBe(true);
  });

  it("false quando a peça está totalmente cercada", () => {
    // Cerca o índice 40 manualmente bloqueando os 4 vizinhos.
    const walls: WallSet = {
      placements: [],
      blockedAdj: new Set([adjKey(40, 31), adjKey(40, 49), adjKey(40, 39), adjKey(40, 41)]),
      occupiedInter: new Set(),
    };
    expect(neighbors(walls, 40)).toEqual([]);
    expect(hasPathToRow(walls, 40, 8)).toBe(false);
    expect(hasPathToRow(walls, 40, 0)).toBe(false);
  });
});

describe("allPossiblePlacements", () => {
  it("gera 128 placements (64 intersecções × 2 tipos)", () => {
    const all = [...allPossiblePlacements()];
    expect(all).toHaveLength(128);
    expect(all.every((p) => p.interRow >= 0 && p.interRow <= 7 && p.interCol >= 0 && p.interCol <= 7)).toBe(true);
    expect(all.filter((p) => p.type === "h")).toHaveLength(64);
    expect(all.filter((p) => p.type === "v")).toHaveLength(64);
  });
});
