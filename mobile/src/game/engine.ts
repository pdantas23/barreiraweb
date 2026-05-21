import { goalRow, opponentOf, row } from "./board";
import { isValidPieceMove } from "./moves";
import type { GameState, Move, MoveResult, PlayerId } from "./types";
import { canPlaceWall, hasPathToRow, registerWall } from "./walls";

const setPiece = (state: GameState, player: PlayerId, to: number): GameState =>
  player === 1 ? { ...state, p1: to } : { ...state, p2: to };

const checkWinner = (state: GameState): PlayerId | null => {
  if (row(state.p1) === goalRow(1)) return 1;
  if (row(state.p2) === goalRow(2)) return 2;
  return null;
};

// Função única e autoritativa pra aplicar uma jogada com validação completa.
export const applyMove = (
  state: GameState,
  player: PlayerId,
  move: Move,
): MoveResult => {
  if (state.winner !== null) return { ok: false, error: "game-over" };
  if (state.turn !== player) return { ok: false, error: "not-your-turn" };

  if (move.kind === "piece") {
    if (!isValidPieceMove(state, player, move.to)) {
      return { ok: false, error: "invalid-piece-move" };
    }
    let next = setPiece(state, player, move.to);
    const winner = checkWinner(next);
    next = { ...next, turn: opponentOf(player), winner };
    return { ok: true, state: next };
  }

  // wall
  if (state.wallsLeft[player] <= 0) {
    return { ok: false, error: "no-walls-left" };
  }
  if (!canPlaceWall(state.walls, move.placement)) {
    return { ok: false, error: "invalid-wall-placement" };
  }

  // Carimba o dono na parede pra o renderizador escolher a cor depois.
  const placementWithOwner = { ...move.placement, owner: player };
  const nextWalls = registerWall(state.walls, placementWithOwner);

  // Nenhuma parede pode fechar totalmente o caminho de qualquer jogador
  if (
    !hasPathToRow(nextWalls, state.p1, goalRow(1)) ||
    !hasPathToRow(nextWalls, state.p2, goalRow(2))
  ) {
    return { ok: false, error: "wall-blocks-goal" };
  }

  const next: GameState = {
    ...state,
    walls: nextWalls,
    wallsLeft: {
      ...state.wallsLeft,
      [player]: state.wallsLeft[player] - 1,
    },
    turn: opponentOf(player),
  };
  return { ok: true, state: next };
};
