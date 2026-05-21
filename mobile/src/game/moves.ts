import { BOARD_SIZE, at, col, opponentOf, piecePosition, row } from "./board";
import type { GameState, PlayerId } from "./types";
import { isBlocked } from "./walls";

const inBounds = (r: number, c: number): boolean =>
  r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

// Casas válidas pra mover (regras oficiais do Quoridor):
// - 4 direções ortogonais
// - se há adversário adjacente sem parede entre nós: salto reto por cima dele
// - se o salto reto está bloqueado (parede atrás do adversário OU borda do tabuleiro):
//   salto diagonal pras duas casas laterais ao adversário, desde que não haja
//   parede entre o adversário e a casa diagonal
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
    if (!inBounds(nr, nc)) return;
    const next = at(nr, nc);
    if (isBlocked(state.walls, me, next)) return;

    if (next !== opp) {
      moves.push(next);
      return;
    }

    // Adversário adjacente sem parede entre nós. Tenta salto reto primeiro.
    const jr = nr + dr;
    const jc = nc + dc;
    const straightInBounds = inBounds(jr, jc);
    const straightBlocked =
      !straightInBounds || isBlocked(state.walls, next, at(jr, jc));

    if (!straightBlocked) {
      moves.push(at(jr, jc));
      return;
    }

    // Salto reto bloqueado: oferece os dois saltos diagonais perpendiculares.
    // Perpendicular a (dr, dc): (dc, dr) e (-dc, -dr).
    const diagonals: Array<[number, number]> = [
      [dc, dr],
      [-dc, -dr],
    ];
    for (const [pdr, pdc] of diagonals) {
      const sr = nr + pdr;
      const sc = nc + pdc;
      if (!inBounds(sr, sc)) continue;
      const diag = at(sr, sc);
      if (isBlocked(state.walls, next, diag)) continue;
      moves.push(diag);
    }
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
