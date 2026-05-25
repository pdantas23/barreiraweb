import { BOARD_SIZE, goalRow } from "./board";
import { getValidMoves } from "./moves";
import type { GameState, Move, PlayerId } from "./types";
import { allPossiblePlacements, neighbors, canPlaceWall, registerWall } from "./walls";

// === Personalidade do bot ===
//
// aggression  — 0 = só avança, 1 = equilibrado, 2 = só bloqueia
//
// wallMinGain — parede só entra no pool se aumentar a distância do oponente
//               em pelo menos este valor. Evita gastar paredes sem critério.
//               Alto  = paredes raras e muito eficientes
//               Baixo = paredes usadas com frequência moderada
//
// topK        — sorteia aleatoriamente entre as top-K melhores jogadas.
//               1 = sempre a melhor (robótico), 5+ = muita variedade dentro da partida.

export type BotPersonality = {
  aggression: number;
  wallMinGain: number;
  topK: number;
};

export const PERSONALITIES: ReadonlyArray<BotPersonality> = [
  { aggression: 0.7, wallMinGain: 1.5, topK: 5 }, // corredor: avança, paredes só quando bloqueiam muito
  { aggression: 1.0, wallMinGain: 1.0, topK: 3 }, // equilibrado: usa paredes quando valem a pena
  { aggression: 1.5, wallMinGain: 0.5, topK: 2 }, // bloqueador: usa paredes com frequência, mas não spam
  { aggression: 1.0, wallMinGain: 1.2, topK: 7 }, // imprevisível: critério razoável, mas escolha muito variada
];

export const randomPersonality = (): BotPersonality =>
  PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];

// === BFS distância até a linha de chegada ===

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

// === Bot Médio: top-K com avaliação personalizada ===
//
// 1. Avalia todos os movimentos de peça.
// 2. Avalia paredes, mas só inclui no pool as que melhoram humanDist
//    em ≥ wallMinGain — evita spam de parede no início da partida.
// 3. Ordena tudo por score e sorteia entre os top-K.
//    Com K=3 o bot tem boa variação dentro da partida sem parecer aleatório.

export const smartOpponentMove = (
  state: GameState,
  botId: PlayerId,
  personality: BotPersonality = PERSONALITIES[1],
): Move | null => {
  const humanId: PlayerId = botId === 1 ? 2 : 1;
  const botPos   = botId   === 1 ? state.p1 : state.p2;
  const humanPos = humanId === 1 ? state.p1 : state.p2;

  const scored: Array<{ move: Move; score: number }> = [];

  // --- Movimentos de peça ---
  for (const to of getValidMoves(state, botId)) {
    const newBotState = { ...state, [botId === 1 ? "p1" : "p2"]: to };
    const botDist   = shortestPathDistance(newBotState, to, goalRow(botId));
    const humanDist = shortestPathDistance(state, humanPos, goalRow(humanId));
    const score = personality.aggression * humanDist - (2 - personality.aggression) * botDist;
    scored.push({ move: { kind: "piece", to }, score });
  }

  // --- Movimentos de parede ---
  // Só entra no pool se:
  //  a) não tranca nenhum jogador (botDist e humanDist ≠ 999)
  //  b) humanDist aumenta pelo menos wallMinGain em relação à distância atual
  //     (garante que a parede realmente atrapalha o oponente)
  if (state.wallsLeft[botId] > 0) {
    const humanDistBase = shortestPathDistance(state, humanPos, goalRow(humanId));

    for (const placement of allPossiblePlacements()) {
      if (!canPlaceWall(state.walls, placement)) continue;
      const nextWalls  = registerWall(state.walls, placement);
      const newState   = { ...state, walls: nextWalls };
      const botDist    = shortestPathDistance(newState, botPos,   goalRow(botId));
      const humanDist  = shortestPathDistance(newState, humanPos, goalRow(humanId));
      if (botDist === 999 || humanDist === 999) continue;

      // Verifica se a parede realmente bloqueia o suficiente
      const humanGain = humanDist - humanDistBase;
      if (humanGain < personality.wallMinGain) continue;

      const score = personality.aggression * humanDist - (2 - personality.aggression) * botDist;
      scored.push({ move: { kind: "wall", placement }, score });
    }
  }

  if (scored.length === 0) return null;

  // Ordena do melhor pro pior e sorteia entre os top-K
  scored.sort((a, b) => b.score - a.score);
  const k    = Math.min(personality.topK, scored.length);
  const pick = scored[Math.floor(Math.random() * k)];
  return pick.move;
};
