import { applyMove } from "./engine";
import { getValidMoves } from "./moves";
import type { GameState, Move, PlayerId } from "./types";
import { allPossiblePlacements } from "./walls";

// Coleta TODAS as jogadas legais (peça + paredes) e escolhe uma uniformemente
// ao acaso. Se ainda tem paredes, com 30% de chance prioriza tentar uma parede
// (pra sentir menos "robótico" só correndo em linha reta).
export const randomOpponentMove = (
  state: GameState,
  player: PlayerId,
): Move | null => {
  const pieceMoves: Move[] = getValidMoves(state, player).map((to) => ({
    kind: "piece",
    to,
  }));

  let wallMoves: Move[] = [];
  if (state.wallsLeft[player] > 0) {
    for (const placement of allPossiblePlacements()) {
      const test = applyMove(state, player, { kind: "wall", placement });
      if (test.ok) wallMoves.push({ kind: "wall", placement });
    }
  }

  const wantWall = wallMoves.length > 0 && Math.random() < 0.3;
  const pool = wantWall ? wallMoves : pieceMoves.length > 0 ? pieceMoves : wallMoves;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
};
