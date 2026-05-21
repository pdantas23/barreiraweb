import { BOARD_SIZE, at, col, opponentOf, piecePosition, row } from "./board";
import type { GameState, PlayerId } from "./types";
import { isBlocked } from "./walls";

// Casas válidas pra mover, com regras do inicial.html:
// - 4 direções ortogonais
// - se vai bater na peça do adversário sem parede, salta sobre ela
export const getValidMoves = (state: GameState, player: PlayerId): number[] => {
  if (state.winner !== null) return [];
  const me = piecePosition(state, player);
  const opp = piecePosition(state, opponentOf(player));
  const r = row(me);
  const c = col(me);

  const moves: number[] = [];

  const tryDir = (dr: number, dc: number) => {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) return;
    const next = at(nr, nc);
    if (isBlocked(state.walls, me, next)) return;

    if (next !== opp) {
      moves.push(next);
      return;
    }

    // Salto sobre o adversário
    const jr = nr + dr;
    const jc = nc + dc;
    if (jr < 0 || jr >= BOARD_SIZE || jc < 0 || jc >= BOARD_SIZE) return;
    const jump = at(jr, jc);
    if (isBlocked(state.walls, next, jump)) return;
    moves.push(jump);
  };

  tryDir(-1, 0);
  tryDir(1, 0);
  tryDir(0, -1);
  tryDir(0, 1);

  return moves;
};

export const isValidPieceMove = (
  state: GameState,
  player: PlayerId,
  to: number,
): boolean => getValidMoves(state, player).includes(to);
