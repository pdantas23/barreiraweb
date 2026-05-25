import { BOARD_SIZE, goalRow, opponentOf } from "./board";
import { applyMove } from "./engine";
import { getValidMoves } from "./moves";
import type { GameState, Move, PlayerId } from "./types";
import { allPossiblePlacements, canPlaceWall, neighbors, registerWall } from "./walls";
import { type BotPersonality, PERSONALITIES, randomPersonality } from "./smartOpponent";
export type { BotPersonality };
export { randomPersonality };

// Bot Difícil: minimax com alfa-beta, profundidade 2 (bot → humano).
// - Função de avaliação considera distância via BFS + saldo de paredes.
// - Move ordering: peças antes de paredes (gera mais cortes).
// - Branching de paredes é filtrado por raio ao redor das peças pra manter
//   o tempo de cálculo aceitável (~200ms no iPhone modesto).
// - Early-game shortcut: enquanto ninguém colocou parede e o bot está longe
//   do goal, pula minimax e joga gananciosamente (só peça). Em Quoridor
//   early-game peças apenas correm, então não perde qualidade e elimina o
//   gargalo de 128 placements × 2 BFS por nó.

const MAX_DEPTH = 2;
const WALL_RADIUS = 2; // intersecções a até N células das peças
const WIN_SCORE = 10000;
// Atalho early-game: enquanto bot está a >= N linhas do goal e ninguém colocou
// parede, pula o minimax. Cobre os ~3 primeiros turnos do bot.
const EARLY_GAME_ROW_DIST = 6;

const rowOf = (idx: number) => Math.floor(idx / BOARD_SIZE);
const colOf = (idx: number) => idx % BOARD_SIZE;

const shortestPathDistance = (state: GameState, from: number, targetRow: number): number => {
  if (rowOf(from) === targetRow) return 0;
  const visited = new Set<number>([from]);
  const queue: Array<[number, number]> = [[from, 0]];
  let head = 0;
  while (head < queue.length) {
    const [cur, dist] = queue[head++];
    for (const n of neighbors(state.walls, cur)) {
      if (visited.has(n)) continue;
      if (rowOf(n) === targetRow) return dist + 1;
      visited.add(n);
      queue.push([n, dist + 1]);
    }
  }
  return 999;
};

const evaluate = (
  state: GameState,
  botId: PlayerId,
  humanId: PlayerId,
  p: BotPersonality,
): number => {
  if (state.winner === botId) return WIN_SCORE;
  if (state.winner === humanId) return -WIN_SCORE;
  const botPos = botId === 1 ? state.p1 : state.p2;
  const humanPos = humanId === 1 ? state.p1 : state.p2;
  const botDist = shortestPathDistance(state, botPos, goalRow(botId));
  const humanDist = shortestPathDistance(state, humanPos, goalRow(humanId));
  if (botDist === 999) return -WIN_SCORE;
  if (humanDist === 999) return WIN_SCORE;
  // Mesma fórmula do smart: aggression controla peso bloqueio vs avanço.
  const distScore = (p.aggression * humanDist - (2 - p.aggression) * botDist) * 10;
  // wallBias influencia o valor de manter paredes na mão.
  const wallScore = (state.wallsLeft[botId] - state.wallsLeft[humanId]) * (0.3 + p.wallBias * 0.2);
  return distScore + wallScore;
};

// Filtra paredes que ficariam longe demais das peças pra ter efeito útil —
// reduz branching de 128 pra ~30 mantendo qualidade.
const wallNearPieces = (
  state: GameState,
  ir: number,
  ic: number,
): boolean => {
  const targets = [state.p1, state.p2];
  for (const t of targets) {
    const r = rowOf(t);
    const c = colOf(t);
    if (Math.abs(ir - r) <= WALL_RADIUS && Math.abs(ic - c) <= WALL_RADIUS) {
      return true;
    }
  }
  return false;
};

const generateMoves = (state: GameState, player: PlayerId): Move[] => {
  const pieceMoves: Move[] = getValidMoves(state, player).map((to) => ({
    kind: "piece" as const,
    to,
  }));

  const wallMoves: Move[] = [];
  if (state.wallsLeft[player] > 0) {
    for (const placement of allPossiblePlacements()) {
      if (!wallNearPieces(state, placement.interRow, placement.interCol)) continue;
      if (!canPlaceWall(state.walls, placement)) continue;
      // Pula paredes que isolam algum jogador (caro mas vital pra evitar nós ilegais)
      const nextWalls = registerWall(state.walls, placement);
      const botDist = shortestPathDistance({ ...state, walls: nextWalls }, state.p1, goalRow(1));
      const humanDist = shortestPathDistance({ ...state, walls: nextWalls }, state.p2, goalRow(2));
      if (botDist === 999 || humanDist === 999) continue;
      wallMoves.push({ kind: "wall", placement });
    }
  }

  // Ordering: peças primeiro (alfa-beta corta mais)
  return [...pieceMoves, ...wallMoves];
};

const minimax = (
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMax: boolean,
  botId: PlayerId,
  humanId: PlayerId,
  p: BotPersonality,
): number => {
  if (depth === 0 || state.winner !== null) {
    return evaluate(state, botId, humanId, p);
  }
  const player: PlayerId = isMax ? botId : humanId;
  const turnedState: GameState = { ...state, turn: player };
  const moves = generateMoves(turnedState, player);
  if (moves.length === 0) return evaluate(state, botId, humanId, p);

  if (isMax) {
    let best = -Infinity;
    for (const move of moves) {
      const res = applyMove(turnedState, player, move);
      if (!res.ok) continue;
      const score = minimax(res.state, depth - 1, alpha, beta, false, botId, humanId, p);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const res = applyMove(turnedState, player, move);
      if (!res.ok) continue;
      const score = minimax(res.state, depth - 1, alpha, beta, true, botId, humanId, p);
      if (score < best) best = score;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
};

// Greedy 1-ply só com peças — usado no atalho early-game.
const greedyPieceMove = (
  state: GameState,
  botId: PlayerId,
  humanId: PlayerId,
  p: BotPersonality,
): Move | null => {
  const turnedState: GameState = { ...state, turn: botId };
  let bestScore = -Infinity;
  let bestMove: Move | null = null;
  for (const to of getValidMoves(turnedState, botId)) {
    const res = applyMove(turnedState, botId, { kind: "piece", to });
    if (!res.ok) continue;
    const score = evaluate(res.state, botId, humanId, p);
    if (score > bestScore) { bestScore = score; bestMove = { kind: "piece", to }; }
  }
  return bestMove;
};

export const minimaxOpponentMove = (
  state: GameState,
  botId: PlayerId,
  personality: BotPersonality = PERSONALITIES[1], // equilibrado por padrão
): Move | null => {
  const humanId = opponentOf(botId);
  const p = personality;

  // Atalho early-game: ninguém colocou parede E bot ainda longe do goal →
  // greedy de peça, sem rodar minimax. Mata a lentidão dos primeiros turnos.
  const botPos = botId === 1 ? state.p1 : state.p2;
  const botRowDist = Math.abs(rowOf(botPos) - goalRow(botId));
  if (state.walls.placements.length === 0 && botRowDist >= EARLY_GAME_ROW_DIST) {
    return greedyPieceMove(state, botId, humanId, p);
  }

  const turnedState: GameState = { ...state, turn: botId };
  const moves = generateMoves(turnedState, botId);
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  let bestMove: Move | null = null;

  for (const move of moves) {
    const res = applyMove(turnedState, botId, move);
    if (!res.ok) continue;
    const score = minimax(res.state, MAX_DEPTH - 1, -Infinity, Infinity, false, botId, humanId, p);
    if (score > bestScore) { bestScore = score; bestMove = move; }
  }

  return bestMove;
};
