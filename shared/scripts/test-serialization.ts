// Critério de teste da Fase 0 / Passo 3:
// deserialize(serialize(state)) === state, mesmo com paredes colocadas.
//
// Rodar com: npx tsx shared/scripts/test-serialization.ts

import { initialState } from "../src/board";
import { applyMove } from "../src/engine";
import { deserializeState, serializeState } from "../src/serialization";
import type { GameState } from "../src/types";

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error("✗ FAIL:", msg);
    process.exit(1);
  }
  console.log("✓", msg);
};

// Comparação estrutural — Sets dentro de WallSet são comparados por conteúdo.
const equalStates = (a: GameState, b: GameState): boolean => {
  if (a.p1 !== b.p1 || a.p2 !== b.p2 || a.turn !== b.turn) return false;
  if (a.winner !== b.winner) return false;
  if (a.wallsLeft[1] !== b.wallsLeft[1] || a.wallsLeft[2] !== b.wallsLeft[2]) return false;
  if (a.walls.placements.length !== b.walls.placements.length) return false;
  if (a.walls.blockedAdj.size !== b.walls.blockedAdj.size) return false;
  if (a.walls.occupiedInter.size !== b.walls.occupiedInter.size) return false;
  for (const k of a.walls.blockedAdj) if (!b.walls.blockedAdj.has(k)) return false;
  for (const k of a.walls.occupiedInter) if (!b.walls.occupiedInter.has(k)) return false;
  return true;
};

// === Teste 1: estado inicial ===
const s0 = initialState();
const r0 = deserializeState(serializeState(s0));
assert(equalStates(s0, r0), "estado inicial faz roundtrip limpo");

// === Teste 2: estado com 3 paredes colocadas (1 H + 2 V) ===
let s: GameState = s0;
const moves = [
  { player: 1 as const, move: { kind: "wall" as const, placement: { type: "h" as const, interRow: 4, interCol: 3 } } },
  { player: 2 as const, move: { kind: "wall" as const, placement: { type: "v" as const, interRow: 2, interCol: 5 } } },
  { player: 1 as const, move: { kind: "wall" as const, placement: { type: "v" as const, interRow: 6, interCol: 1 } } },
];
for (const { player, move } of moves) {
  const res = applyMove(s, player, move);
  if (!res.ok) {
    console.error("setup falhou:", res.error);
    process.exit(1);
  }
  s = res.state;
}

assert(s.walls.placements.length === 3, "estado tem 3 paredes");
assert(s.walls.blockedAdj.size === 6, "tem 6 adjacências bloqueadas (3 paredes × 2)");
assert(s.walls.occupiedInter.size === 3, "tem 3 intersecções ocupadas");

const r = deserializeState(serializeState(s));
assert(equalStates(s, r), "estado com 3 paredes faz roundtrip limpo");

// === Teste 3: JSON real (mais próximo do que vai pelo socket) ===
const wireJson = JSON.stringify(serializeState(s));
const parsed = JSON.parse(wireJson);
const r2 = deserializeState(parsed);
assert(equalStates(s, r2), "estado sobrevive a JSON.stringify/parse (wire real)");

// === Teste 4: mistura peça + parede ===
let m: GameState = initialState();
const mixedMoves = [
  { player: 1 as const, move: { kind: "piece" as const, to: 67 } }, // P1 sobe
  { player: 2 as const, move: { kind: "piece" as const, to: 13 } }, // P2 desce
  { player: 1 as const, move: { kind: "wall" as const, placement: { type: "h" as const, interRow: 3, interCol: 4 } } },
];
for (const { player, move } of mixedMoves) {
  const res = applyMove(m, player, move);
  if (!res.ok) { console.error("setup mixed falhou:", res.error); process.exit(1); }
  m = res.state;
}
const rm = deserializeState(JSON.parse(JSON.stringify(serializeState(m))));
assert(equalStates(m, rm), "estado misturado (peças + parede) sobrevive a roundtrip");

console.log("\n✓ Todos os testes de serialização passaram.");
