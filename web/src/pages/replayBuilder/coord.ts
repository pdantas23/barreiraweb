// === Conversor entre a notacao humana ("e4", "c-d", "Linhas 6/7")
//     e os indices do engine (row*9 + col, interRow/interCol).
//
// Notacao humana:
//   - Colunas: a-i (a=0, b=1, ..., i=8)
//   - Linhas:  1-9 (engine row = user row - 1, ou seja row 1=top, row 9=bottom)
//
// Posicoes iniciais do engine:
//   - P1 = e9 (user) = engine row 8, col 4 (INITIAL_P1 = 76)
//   - P2 = e1 (user) = engine row 0, col 4 (INITIAL_P2 = 4)

import { BOARD_SIZE } from "@barreira/shared";

export const COL_MIN = "a".charCodeAt(0);
export const COL_MAX = "i".charCodeAt(0);

/** "e" -> 4, "a" -> 0, "i" -> 8. Retorna null se invalido. */
export const colLetterToIndex = (letter: string): number | null => {
  if (letter.length !== 1) return null;
  const code = letter.toLowerCase().charCodeAt(0);
  if (code < COL_MIN || code > COL_MAX) return null;
  return code - COL_MIN;
};

/** "1" -> 0, "9" -> 8. Retorna null se invalido. */
export const userRowToEngine = (userRow: number): number | null => {
  if (!Number.isInteger(userRow)) return null;
  if (userRow < 1 || userRow > BOARD_SIZE) return null;
  return userRow - 1;
};

/** "e4" -> engine cell index (4*9+4=40). Null se invalido. */
export const parseCell = (notation: string): number | null => {
  const m = notation.trim().match(/^([a-iA-I])(\d)$/);
  if (!m) return null;
  const colIdx = colLetterToIndex(m[1]);
  const engineRow = userRowToEngine(Number(m[2]));
  if (colIdx === null || engineRow === null) return null;
  return engineRow * BOARD_SIZE + colIdx;
};

/** Engine cell index -> "e4". */
export const cellToNotation = (index: number): string => {
  const r = Math.floor(index / BOARD_SIZE);
  const c = index % BOARD_SIZE;
  const colLetter = String.fromCharCode(COL_MIN + c);
  const userRow = r + 1;
  return `${colLetter}${userRow}`;
};

/**
 * Parseia uma especificacao de parede como "entre e-f (Linhas 1/2)" ou
 * "entre c-d (Linhas 6/7)" devolvendo {interCol, interRow} do engine.
 *
 * Convencao de interseccao (do engine):
 *   - interCol = indice da coluna da esquerda (a coluna da direita eh ic+1)
 *   - interRow = indice da linha de cima      (a linha de baixo eh ir+1)
 *
 * Exemplo: "entre e-f (Linhas 1/2)"
 *   - colunas e-f = engine cols 4-5 -> interCol = 4
 *   - linhas 1-2  = engine rows 0-1 -> interRow = 0
 */
export const parseWallSpec = (
  colsSpec: string,
  rowsSpec: string,
): { interCol: number; interRow: number } | null => {
  const colMatch = colsSpec.trim().match(/^([a-iA-I])\s*-\s*([a-iA-I])$/);
  if (!colMatch) return null;
  const c1 = colLetterToIndex(colMatch[1]);
  const c2 = colLetterToIndex(colMatch[2]);
  if (c1 === null || c2 === null) return null;
  if (c2 !== c1 + 1) return null; // colunas precisam ser consecutivas
  const interCol = c1;

  const rowMatch = rowsSpec.trim().match(/^(\d)\s*\/\s*(\d)$/);
  if (!rowMatch) return null;
  const userR1 = Number(rowMatch[1]);
  const userR2 = Number(rowMatch[2]);
  const r1 = userRowToEngine(userR1);
  const r2 = userRowToEngine(userR2);
  if (r1 === null || r2 === null) return null;
  if (r2 !== r1 + 1) return null; // linhas precisam ser consecutivas
  const interRow = r1;

  // Sanity: ambas tem que estar em [0, BOARD_SIZE-2]
  if (interCol < 0 || interCol > BOARD_SIZE - 2) return null;
  if (interRow < 0 || interRow > BOARD_SIZE - 2) return null;

  return { interCol, interRow };
};
