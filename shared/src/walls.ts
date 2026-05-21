import { BOARD_SIZE, at, col, inBounds, row } from "./board";
import type { WallPlacement, WallSet } from "./types";

// === Chaves canônicas dos Sets ===

// Adjacência entre 2 casas: ordem normalizada pra (a,b) e (b,a) colidirem.
export const adjKey = (a: number, b: number): string => {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${lo}-${hi}`;
};

// Intersecção (ir, ic) entre 4 casas.
const interKey = (ir: number, ic: number): string => `${ir},${ic}`;

// === Construtor ===

export const createEmptyWalls = (): WallSet => ({
  placements: [],
  blockedAdj: new Set(),
  occupiedInter: new Set(),
});

// === Conversão placement → adjacências bloqueadas ===

// H em (ir, ic): linha horizontal entre row ir e row ir+1, cobrindo cols ic e ic+1.
//   Bloqueia as duas adjacências verticais (ir,ic)↔(ir+1,ic) e (ir,ic+1)↔(ir+1,ic+1).
// V em (ir, ic): coluna vertical entre col ic e col ic+1, cobrindo rows ir e ir+1.
//   Bloqueia (ir,ic)↔(ir,ic+1) e (ir+1,ic)↔(ir+1,ic+1).
const placementToBlockedAdj = (
  p: WallPlacement,
): Array<{ a: number; b: number }> | null => {
  const { interRow: ir, interCol: ic, type } = p;
  if (ir < 0 || ir > BOARD_SIZE - 2 || ic < 0 || ic > BOARD_SIZE - 2) return null;

  if (type === "h") {
    return [
      { a: at(ir, ic), b: at(ir + 1, ic) },
      { a: at(ir, ic + 1), b: at(ir + 1, ic + 1) },
    ];
  }
  return [
    { a: at(ir, ic), b: at(ir, ic + 1) },
    { a: at(ir + 1, ic), b: at(ir + 1, ic + 1) },
  ];
};

// === Consultas ===

export const isBlocked = (walls: WallSet, a: number, b: number): boolean =>
  walls.blockedAdj.has(adjKey(a, b));

export const canPlaceWall = (walls: WallSet, p: WallPlacement): boolean => {
  const adjs = placementToBlockedAdj(p);
  if (!adjs) return false;

  // Regra crítica do Quoridor: não pode cruzar outra parede.
  // Como H e V na mesma intersecção compartilham o ponto central, basta
  // bloquear qualquer placement (H ou V) numa intersecção já ocupada.
  if (walls.occupiedInter.has(interKey(p.interRow, p.interCol))) return false;

  // Não pode sobrepor: nenhuma das adjacências que a parede bloquearia
  // pode já estar bloqueada por outra parede (mesmo tipo, intersecção adjacente).
  for (const adj of adjs) {
    if (walls.blockedAdj.has(adjKey(adj.a, adj.b))) return false;
  }
  return true;
};

// === Mutação (retorna novo WallSet imutável) ===

export const registerWall = (walls: WallSet, p: WallPlacement): WallSet => {
  const adjs = placementToBlockedAdj(p);
  if (!adjs) return walls;
  const next: WallSet = {
    placements: [...walls.placements, p],
    blockedAdj: new Set(walls.blockedAdj),
    occupiedInter: new Set(walls.occupiedInter),
  };
  for (const adj of adjs) next.blockedAdj.add(adjKey(adj.a, adj.b));
  next.occupiedInter.add(interKey(p.interRow, p.interCol));
  return next;
};

// === Grafo de adjacência (usado por BFS / movimento) ===

export const neighbors = (walls: WallSet, index: number): number[] => {
  const r = row(index);
  const c = col(index);
  const out: number[] = [];
  const cand: Array<[number, number]> = [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
  for (const [nr, nc] of cand) {
    if (!inBounds(nr, nc)) continue;
    const ni = at(nr, nc);
    if (isBlocked(walls, index, ni)) continue;
    out.push(ni);
  }
  return out;
};

// BFS: a parede que estamos colocando não pode fechar totalmente o caminho
// de nenhum jogador até sua linha-alvo.
export const hasPathToRow = (
  walls: WallSet,
  from: number,
  targetRow: number,
): boolean => {
  if (row(from) === targetRow) return true;
  const visited = new Set<number>([from]);
  const queue: number[] = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of neighbors(walls, cur)) {
      if (visited.has(n)) continue;
      if (row(n) === targetRow) return true;
      visited.add(n);
      queue.push(n);
    }
  }
  return false;
};

// 64 intersecções × 2 tipos = 128 placements possíveis pro adversário random testar.
export function* allPossiblePlacements(): Generator<WallPlacement> {
  for (let ir = 0; ir < BOARD_SIZE - 1; ir++) {
    for (let ic = 0; ic < BOARD_SIZE - 1; ic++) {
      yield { type: "h", interRow: ir, interCol: ic };
      yield { type: "v", interRow: ir, interCol: ic };
    }
  }
}
