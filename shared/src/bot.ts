// === Bot do Barreira — minimax α-β único, 3 dificuldades por profundidade ===
//
// IMPLEMENTAÇÃO ÚNICA, reutilizada por todos os consumidores (web/mobile
// offline e server online) via `botMove(state, botId, difficulty)`. Nenhum
// consumidor tem lógica de bot própria — todos importam daqui.
//
// Os 3 níveis usam EXATAMENTE o mesmo minimax α-β com avaliação por BFS. A
// ÚNICA diferença entre eles é a PROFUNDIDADE de lookahead (quantos plies à
// frente o bot enxerga):
//   easy   = 1 ply  → decide olhando só o estado imediato (andar vs. parede agora)
//   medium = 3 plies → planeja 2-3 jogadas à frente
//   hard   = 4 plies → sequências longas de avanço + bloqueio (muito forte)
//
// SEM aleatoriedade em qualquer nível: toda jogada é resultado do minimax.
// Empates são resolvidos de forma DETERMINÍSTICA — a ordenação coloca peças
// antes de paredes, e o root só troca a melhor jogada em score ESTRITAMENTE
// maior, então em empate fica o primeiro lance (prefere avançar). Se o minimax
// não achar jogada (não deve acontecer), cai num fallback BFS rumo ao objetivo.

import { BOARD_SIZE, goalRow, opponentOf } from "./board";
import { applyMove } from "./engine";
import { getValidMoves } from "./moves";
import type { GameState, Move, PlayerId } from "./types";
import { allPossiblePlacements, canPlaceWall, isBlocked } from "./walls";

const TOTAL_SQUARES = BOARD_SIZE * BOARD_SIZE;

export type BotDifficulty = "easy" | "medium" | "hard";

// Profundidade de busca por nível (em plies). Único parâmetro que diferencia
// as dificuldades. hard fica em 4 (dentro de 4-5) por equilíbrio entre força e
// custo: o minimax é síncrono e, no server online, segurar o event loop por
// muito tempo atrasaria as outras partidas.
const DEPTH: Record<BotDifficulty, number> = {
  easy: 1,
  medium: 3,
  hard: 4,
};

const UNREACHABLE = 999;
const WIN_SCORE = 100_000;
// Só considera paredes a até N casas de alguma peça — reduz o branching de 128
// placements pra ~algumas dezenas, mantendo as paredes que de fato importam.
// Raio 1 (paredes adjacentes às peças) mantém o branching baixo o bastante pra
// a busca profunda do "hard" rodar rápido sem travar o event loop do server.
const WALL_RADIUS = 1;

const rowOf = (idx: number): number => Math.floor(idx / BOARD_SIZE);
const colOf = (idx: number): number => idx % BOARD_SIZE;
const pieceOf = (state: GameState, id: PlayerId): number =>
  id === 1 ? state.p1 : state.p2;

// BFS por níveis: menor número de passos de `from` até a linha-objetivo.
// Hot path do minimax (chamado em cada folha + na avaliação), então é
// otimizado: vizinhos inline (sem alocar array por nó) e `visited` em
// Uint8Array. `isBlocked` é só um lookup de Set.
const shortestPathDistance = (
  state: GameState,
  from: number,
  targetRow: number,
): number => {
  if (rowOf(from) === targetRow) return 0;
  const walls = state.walls;
  const visited = new Uint8Array(TOTAL_SQUARES);
  visited[from] = 1;
  let frontier: number[] = [from];
  let dist = 0;
  while (frontier.length > 0) {
    dist++;
    const next: number[] = [];
    for (let i = 0; i < frontier.length; i++) {
      const cur = frontier[i];
      const r = (cur / BOARD_SIZE) | 0;
      const c = cur % BOARD_SIZE;
      // 4 vizinhos ortogonais, inline (evita alocação de array por nó).
      if (r > 0) {
        const n = cur - BOARD_SIZE;
        if (!visited[n] && !isBlocked(walls, cur, n)) {
          if (((n / BOARD_SIZE) | 0) === targetRow) return dist;
          visited[n] = 1;
          next.push(n);
        }
      }
      if (r < BOARD_SIZE - 1) {
        const n = cur + BOARD_SIZE;
        if (!visited[n] && !isBlocked(walls, cur, n)) {
          if (((n / BOARD_SIZE) | 0) === targetRow) return dist;
          visited[n] = 1;
          next.push(n);
        }
      }
      if (c > 0) {
        const n = cur - 1;
        if (!visited[n] && !isBlocked(walls, cur, n)) {
          // mesma linha → nunca é a targetRow ao mover lateral; checa mesmo assim
          if (((n / BOARD_SIZE) | 0) === targetRow) return dist;
          visited[n] = 1;
          next.push(n);
        }
      }
      if (c < BOARD_SIZE - 1) {
        const n = cur + 1;
        if (!visited[n] && !isBlocked(walls, cur, n)) {
          if (((n / BOARD_SIZE) | 0) === targetRow) return dist;
          visited[n] = 1;
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return UNREACHABLE;
};

// Avaliação da posição (do ponto de vista do bot):
// + distância BFS do adversário ao objetivo (quanto mais longe, melhor)
// − distância BFS do bot ao objetivo (quanto mais perto, melhor)
// + saldo de paredes na mão (ter mais paredes que o oponente é vantagem).
const evaluate = (state: GameState, botId: PlayerId, humanId: PlayerId): number => {
  if (state.winner === botId) return WIN_SCORE;
  if (state.winner === humanId) return -WIN_SCORE;
  const botDist = shortestPathDistance(state, pieceOf(state, botId), goalRow(botId));
  const humanDist = shortestPathDistance(state, pieceOf(state, humanId), goalRow(humanId));
  if (botDist === UNREACHABLE) return -WIN_SCORE;
  if (humanDist === UNREACHABLE) return WIN_SCORE;
  const distScore = (humanDist - botDist) * 10;
  const wallScore = (state.wallsLeft[botId] - state.wallsLeft[humanId]) * 1;
  return distScore + wallScore;
};

// Paredes candidatas: só as a até WALL_RADIUS de alguma peça.
const wallNearPieces = (state: GameState, ir: number, ic: number): boolean => {
  for (const t of [state.p1, state.p2]) {
    if (Math.abs(ir - rowOf(t)) <= WALL_RADIUS && Math.abs(ic - colOf(t)) <= WALL_RADIUS) {
      return true;
    }
  }
  return false;
};

// Gera as jogadas candidatas de `player`. Peças PRIMEIRO (melhora os cortes do
// α-β e dá prioridade determinística ao avanço em empates), paredes depois.
// Não faz BFS de legalidade aqui — `applyMove` rejeita paredes que trancam o
// caminho (res.ok=false), evitando o BFS duplicado e acelerando a busca.
const generateMoves = (state: GameState, player: PlayerId): Move[] => {
  const moves: Move[] = getValidMoves(state, player).map((to) => ({ kind: "piece", to }));
  if (state.wallsLeft[player] > 0) {
    for (const placement of allPossiblePlacements()) {
      if (!wallNearPieces(state, placement.interRow, placement.interCol)) continue;
      if (!canPlaceWall(state.walls, placement)) continue;
      moves.push({ kind: "wall", placement });
    }
  }
  return moves;
};

const minimax = (
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMax: boolean,
  botId: PlayerId,
  humanId: PlayerId,
): number => {
  if (depth === 0 || state.winner !== null) {
    return evaluate(state, botId, humanId);
  }
  const player: PlayerId = isMax ? botId : humanId;
  const turned: GameState = { ...state, turn: player };
  const moves = generateMoves(turned, player);

  let explored = false;
  if (isMax) {
    let best = -Infinity;
    for (const move of moves) {
      const res = applyMove(turned, player, move);
      if (!res.ok) continue;
      explored = true;
      const score = minimax(res.state, depth - 1, alpha, beta, false, botId, humanId);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return explored ? best : evaluate(state, botId, humanId);
  }
  let best = Infinity;
  for (const move of moves) {
    const res = applyMove(turned, player, move);
    if (!res.ok) continue;
    explored = true;
    const score = minimax(res.state, depth - 1, alpha, beta, true, botId, humanId);
    if (score < best) best = score;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return explored ? best : evaluate(state, botId, humanId);
};

// Fallback determinístico: passo de peça que mais reduz a distância BFS ao
// objetivo (empate → o primeiro na ordem de getValidMoves).
const bfsStep = (state: GameState, botId: PlayerId): Move | null => {
  const goal = goalRow(botId);
  const key = botId === 1 ? "p1" : "p2";
  let bestTo = -1;
  let bestDist = Infinity;
  for (const to of getValidMoves(state, botId)) {
    const sim = { ...state, [key]: to } as GameState;
    const d = shortestPathDistance(sim, to, goal);
    if (d < bestDist) {
      bestDist = d;
      bestTo = to;
    }
  }
  return bestTo === -1 ? null : { kind: "piece", to: bestTo };
};

// Entrada ÚNICA: decide a jogada do bot via minimax α-β na profundidade do nível.
export const botMove = (
  state: GameState,
  botId: PlayerId,
  difficulty: BotDifficulty,
): Move | null => {
  if (state.winner !== null) return null;
  const humanId = opponentOf(botId);
  const depth = DEPTH[difficulty];
  const turned: GameState = { ...state, turn: botId };
  const moves = generateMoves(turned, botId);

  let bestMove: Move | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  for (const move of moves) {
    const res = applyMove(turned, botId, move);
    if (!res.ok) continue;
    const score = minimax(res.state, depth - 1, alpha, Infinity, false, botId, humanId);
    // ESTRITAMENTE maior → empate mantém o primeiro (peças antes de paredes).
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  if (bestMove) return bestMove;

  // Fallback: o minimax não achou jogada (estado degenerado). Tenta o próximo
  // passo BFS; se nem peça houver, qualquer parede legal; senão null.
  const step = bfsStep(state, botId);
  if (step) return step;
  if (state.wallsLeft[botId] > 0) {
    for (const placement of allPossiblePlacements()) {
      if (!canPlaceWall(state.walls, placement)) continue;
      if (applyMove(turned, botId, { kind: "wall", placement }).ok) {
        return { kind: "wall", placement };
      }
    }
  }
  return null;
};
