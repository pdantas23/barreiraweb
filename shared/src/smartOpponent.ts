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

// Todas as personalidades usam paredes — a variação é no ESTILO, não na frequência.
// wallBias >= 0.3 garante que paredes sejam sempre consideradas competitivamente.
// aggression varia o foco (avançar vs bloquear). noise controla a previsibilidade.
export const PERSONALITIES: ReadonlyArray<BotPersonality> = [
  { aggression: 0.7, wallBias: 0.4, noise: 0.7 }, // corredor defensivo: avança mas usa paredes pra proteger caminho
  { aggression: 1.0, wallBias: 0.5, noise: 0.5 }, // equilibrado: balanço clássico
  { aggression: 1.5, wallBias: 0.9, noise: 0.5 }, // bloqueador: agressivo com paredes
  { aggression: 1.1, wallBias: 0.6, noise: 1.8 }, // imprevisível: alto ruído, difícil de antecipar
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
