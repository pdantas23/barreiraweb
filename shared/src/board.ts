import type { GameState, PlayerId, WallSet } from "./types";

export const BOARD_SIZE = 9;
export const TOTAL_SQUARES = BOARD_SIZE * BOARD_SIZE;

export const INITIAL_P1 = 76; // linha 8, col 4 (base de baixo)
export const INITIAL_P2 = 4; // linha 0, col 4 (base de cima)

export const WALLS_PER_PLAYER = 10;

export const row = (index: number): number => Math.floor(index / BOARD_SIZE);
export const col = (index: number): number => index % BOARD_SIZE;
export const at = (r: number, c: number): number => r * BOARD_SIZE + c;
export const inBounds = (r: number, c: number): boolean =>
  r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

export const goalRow = (player: PlayerId): number =>
  player === 1 ? 0 : BOARD_SIZE - 1;

const emptyWalls = (): WallSet => ({
  placements: [],
  blockedAdj: new Set(),
  occupiedInter: new Set(),
});

export const initialState = (): GameState => ({
  p1: INITIAL_P1,
  p2: INITIAL_P2,
  turn: 1,
  walls: emptyWalls(),
  wallsLeft: { 1: WALLS_PER_PLAYER, 2: WALLS_PER_PLAYER },
  winner: null,
});

export const piecePosition = (state: GameState, player: PlayerId): number =>
  player === 1 ? state.p1 : state.p2;

export const opponentOf = (player: PlayerId): PlayerId =>
  player === 1 ? 2 : 1;
