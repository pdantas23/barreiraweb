import { BOARD_SIZE, goalRow } from "./board";
import { getValidMoves } from "./moves";
import type { GameState, Move, PlayerId } from "./types";
import { allPossiblePlacements, neighbors, canPlaceWall, registerWall } from "./walls";

// === Personalidade do bot ===
//
// Cada partida o bot recebe uma personalidade aleatória que altera os pesos
// da função de avaliação, tornando o comportamento variado entre partidas.
//
//  aggression: 0 = só avança, 1 = equilibrado, 2 = só bloqueia
//  wallBias:   bônus de score pra jogadas de parede (+ = ama paredes)
//  noise:      amplitude do ruído aleatório adicionado a cada score
//              (evita sempre escolher exatamente a mesma jogada em empate)

export type BotPersonality = {
  aggression: number;
  wallBias: number;
  noise: number;
};

export const PERSONALITIES: ReadonlyArray<BotPersonality> = [
  { aggression: 0.4, wallBias: -0.5, noise: 0.3 }, // corredor
  { aggression: 1.0, wallBias:  0.3, noise: 0.2 }, // equilibrado (era o padrão anterior)
  { aggression: 1.6, wallBias:  1.0, noise: 0.2 }, // bloqueador
  { aggression: 0.9, wallBias:  0.4, noise: 0.9 }, // imprevisível
];

export const randomPersonality = (): BotPersonality =>
  PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];

// === Distância BFS até a linha de chegada ===

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

// === Função de score com personalidade ===
//
// Formula: aggression × humanDist − (2 − aggression) × botDist
//   aggression = 0 → −2 × botDist   (puro corredor, ignora oponente)
//   aggression = 1 → humanDist − botDist  (equilibrado, antigo padrão)
//   aggression = 2 → 2 × humanDist  (puro bloqueador, ignora própria distância)
//
// wallBias é somado apenas em jogadas de parede.
// noise é ruído uniforme em [−noise/2, +noise/2] pra evitar empates determinísticos.

const scoreMove = (
  botDist: number,
  humanDist: number,
  isWall: boolean,
  p: BotPersonality,
): number => {
  const base = p.aggression * humanDist - (2 - p.aggression) * botDist;
  const wallAdj = isWall ? p.wallBias : 0;
  const noise = (Math.random() - 0.5) * p.noise;
  return base + wallAdj + noise;
};

// === Bot Médio: avaliação 1-nível com personalidade ===
//
// Avalia todas as jogadas legais (peças + paredes) e escolhe a com maior score.
// O ruído garante que empates sejam quebrados de forma variada, e a personalidade
// muda o estilo de jogo a cada partida.

export const smartOpponentMove = (
  state: GameState,
  botId: PlayerId,
  personality: BotPersonality = PERSONALITIES[1], // equilibrado por padrão
): Move | null => {
  const humanId: PlayerId = botId === 1 ? 2 : 1;

  // Posições calculadas uma vez pra não repetir em cada iteração.
  const botPos   = botId   === 1 ? state.p1 : state.p2;
  const humanPos = humanId === 1 ? state.p1 : state.p2;

  let bestScore = -Infinity;
  let bestMove: Move | null = null;

  // --- Movimentos de peça ---
  for (const to of getValidMoves(state, botId)) {
    const simPos = to;
    const botDist   = shortestPathDistance({ ...state, [botId === 1 ? "p1" : "p2"]: to }, simPos, goalRow(botId));
    const humanDist = shortestPathDistance(state, humanPos, goalRow(humanId));
    const score = scoreMove(botDist, humanDist, false, personality);
    if (score > bestScore) { bestScore = score; bestMove = { kind: "piece", to }; }
  }

  // --- Movimentos de parede ---
  if (state.wallsLeft[botId] > 0) {
    for (const placement of allPossiblePlacements()) {
      if (!canPlaceWall(state.walls, placement)) continue;
      const nextWalls = registerWall(state.walls, placement);
      const newState  = { ...state, walls: nextWalls };
      const botDist   = shortestPathDistance(newState, botPos,   goalRow(botId));
      const humanDist = shortestPathDistance(newState, humanPos, goalRow(humanId));
      if (botDist === 999 || humanDist === 999) continue; // nunca bloquear caminho
      const score = scoreMove(botDist, humanDist, true, personality);
      if (score > bestScore) { bestScore = score; bestMove = { kind: "wall", placement }; }
    }
  }

  return bestMove;
};
