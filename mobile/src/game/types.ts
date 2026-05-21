export type PlayerId = 1 | 2;

export type WallType = "h" | "v";

// Parede dupla (regra clássica do Quoridor): cobre 2 casas e é ancorada numa
// INTERSECÇÃO entre 4 casas. interRow/interCol ∈ [0, BOARD_SIZE-2].
// Convenção: a intersecção (ir, ic) fica entre as casas (ir, ic), (ir, ic+1),
// (ir+1, ic), (ir+1, ic+1).
export type WallPlacement = {
  type: WallType;
  interRow: number;
  interCol: number;
  // Quem colocou a parede. O engine preenche automaticamente no applyMove,
  // então quem cria placements no UI/IA não precisa se preocupar com isso.
  owner?: PlayerId;
};

// Estrutura interna pra acelerar consultas:
// - placements: lista pra renderização e contagem
// - blockedAdj: pares "min-max" de casas com adjacência bloqueada (usado pela BFS)
// - occupiedInter: "r,c" das intersecções já ocupadas (previne cruzamento H/V)
export type WallSet = {
  placements: WallPlacement[];
  blockedAdj: Set<string>;
  occupiedInter: Set<string>;
};

export type PieceMove = { kind: "piece"; to: number };
export type WallMove = { kind: "wall"; placement: WallPlacement };
export type Move = PieceMove | WallMove;

export type GameState = {
  p1: number;
  p2: number;
  turn: PlayerId;
  walls: WallSet;
  wallsLeft: Record<PlayerId, number>;
  winner: PlayerId | null;
};

export type MoveError =
  | "not-your-turn"
  | "game-over"
  | "invalid-piece-move"
  | "invalid-wall-placement"
  | "no-walls-left"
  | "wall-blocks-goal";

export type MoveResult =
  | { ok: true; state: GameState }
  | { ok: false; error: MoveError };
