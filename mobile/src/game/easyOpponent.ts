import { BOARD_SIZE, goalRow } from "./board";
import { getValidMoves } from "./moves";
import type { GameState, Move, PlayerId } from "./types";
import { allPossiblePlacements, canPlaceWall, neighbors, registerWall } from "./walls";

const shortestPathDistance = (state: GameState, from: number, targetRow: number): number => {
  if (Math.floor(from / BOARD_SIZE) === targetRow) return 0;
  const visited = new Set<number>([from]);
  const queue: Array<[number, number]> = [[from, 0]];
  let head = 0;
  while (head < queue.length) {
    const [cur, dist] = queue[head++];
    for (const n of neighbors(state.walls, cur)) {
      if (visited.has(n)) continue;
      if (Math.floor(n / BOARD_SIZE) === targetRow) return dist + 1;
      visited.add(n);
      queue.push([n, dist + 1]);
    }
  }
  return 999;
};

// Bot Fácil: ranqueia todas as jogadas legais pelo mesmo score do smart
// (humanDist - botDist), depois sorteia uniformemente entre as TOP_K melhores.
// Resultado: erra pequenas decisões, deixa caminhos abertos que um bot certinho
// fecharia. Não é estúpido (não troca peça por parede sem motivo) — é só "mole".
const TOP_K = 6;

export const easyOpponentMove = (state: GameState, botId: PlayerId): Move | null => {
  const humanId: PlayerId = botId === 1 ? 2 : 1;
  const scored: Array<{ move: Move; score: number }> = [];

  for (const to of getValidMoves(state, botId)) {
    const sim = { ...state, [botId === 1 ? "p1" : "p2"]: to } as GameState;
    const botDist = shortestPathDistance(sim, to, goalRow(botId));
    const humanPos = humanId === 1 ? sim.p1 : sim.p2;
    const humanDist = shortestPathDistance(sim, humanPos, goalRow(humanId));
    scored.push({ move: { kind: "piece", to }, score: humanDist - botDist });
  }

  if (state.wallsLeft[botId] > 0) {
    for (const placement of allPossiblePlacements()) {
      if (!canPlaceWall(state.walls, placement)) continue;
      const nextWalls = registerWall(state.walls, placement);
      const botPos = botId === 1 ? state.p1 : state.p2;
      const humanPos = humanId === 1 ? state.p1 : state.p2;
      const botDist = shortestPathDistance({ ...state, walls: nextWalls }, botPos, goalRow(botId));
      const humanDist = shortestPathDistance({ ...state, walls: nextWalls }, humanPos, goalRow(humanId));
      if (botDist === 999 || humanDist === 999) continue;
      scored.push({ move: { kind: "wall", placement }, score: humanDist - botDist });
    }
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const pool = scored.slice(0, Math.min(TOP_K, scored.length));
  return pool[Math.floor(Math.random() * pool.length)].move;
};
