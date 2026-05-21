import { BOARD_SIZE, goalRow } from "./board";
import { getValidMoves } from "./moves";
import type { GameState, Move, PlayerId } from "./types";
import { allPossiblePlacements, neighbors, canPlaceWall, registerWall } from "./walls";

// 1. Calcula a distância exata até a linha de chegada usando BFS
const shortestPathDistance = (state: GameState, from: number, targetRow: number): number => {
  if (Math.floor(from / BOARD_SIZE) === targetRow) return 0;
  
  const visited = new Set<number>([from]);
  // Fila guarda: [posição_atual, distancia_percorrida]
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
  return 999; // Se não tem caminho, retorna um custo absurdo
};

// 2. A Função de Avaliação (O "Cérebro")
const evaluateState = (state: GameState, botId: PlayerId, humanId: PlayerId): number => {
  const botPos = botId === 1 ? state.p1 : state.p2;
  const humanPos = humanId === 1 ? state.p1 : state.p2;
  
  const botDist = shortestPathDistance(state, botPos, goalRow(botId));
  const humanDist = shortestPathDistance(state, humanPos, goalRow(humanId));
  
  // Quanto maior o número retornado, melhor para o bot.
  // Ele quer maximizar a distância do humano e minimizar a dele.
  return humanDist - botDist; 
};

// 3. O Bot avalia todas as jogadas e escolhe a melhor
export const smartOpponentMove = (state: GameState, botId: PlayerId): Move | null => {
  const humanId = botId === 1 ? 2 : 1;
  let bestScore = -Infinity;
  let bestMoves: Move[] = [];

  // Testa movimentos de peça
  const validPieceMoves = getValidMoves(state, botId);
  for (const to of validPieceMoves) {
    // Cria um estado simulado rápido
    const simulatedState = { ...state, [botId === 1 ? 'p1' : 'p2']: to };
    const score = evaluateState(simulatedState, botId, humanId);
    
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [{ kind: "piece", to }];
    } else if (score === bestScore) {
      bestMoves.push({ kind: "piece", to });
    }
  }

  // Testa colocações de parede (se tiver paredes sobrando)
  if (state.wallsLeft[botId] > 0) {
    for (const placement of allPossiblePlacements()) {
      if (canPlaceWall(state.walls, placement)) {
        const nextWalls = registerWall(state.walls, placement);
        
        // Regra de ouro: a parede não pode trancar nenhum jogador
        const p1Pos = botId === 1 ? state.p1 : state.p2; // gambiarra rapida para as posições
        const p2Pos = humanId === 1 ? state.p1 : state.p2;
        
        const botDist = shortestPathDistance({ ...state, walls: nextWalls }, p1Pos, goalRow(botId));
        const humanDist = shortestPathDistance({ ...state, walls: nextWalls }, p2Pos, goalRow(humanId));

        if (botDist !== 999 && humanDist !== 999) {
          const score = humanDist - botDist;
          // Paredes ganham um pequeno bônus para encorajar o bot a usá-las de forma ofensiva
          const aggressiveScore = score + 0.5; 
          
          if (aggressiveScore > bestScore) {
            bestScore = aggressiveScore;
            bestMoves = [{ kind: "wall", placement }];
          } else if (aggressiveScore === bestScore) {
            bestMoves.push({ kind: "wall", placement });
          }
        }
      }
    }
  }

  if (bestMoves.length === 0) return null;
  // Escolhe aleatoriamente entre as melhores jogadas empatadas para não ficar robótico
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
};