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

// === Anti-loop (correção do ciclo infinito) ===
// O minimax era puramente posicional e sem memória: posições "neutras" formavam
// platôs onde andar não melhorava o score, e ao reencontrar a MESMA posição o
// bot (função determinística) repetia o mesmo lance — ciclo infinito. Três
// peças quebram isso SEM aleatoriedade: (1) detecção de repetição no caminho de
// busca, (2) termo de progresso absoluto, (3) escolha entre os top-3 no root.

// Distância BFS de referência pro termo de progresso absoluto. Num 9x9 o
// caminho razoável fica abaixo disso; serve só de base fixa pra recompensar
// avançar rumo ao objetivo (quanto menor a distância, maior o bônus).
const MAX_DIST = 16;
// Penalidade forte aplicada a um lance que recria uma posição já vista no
// caminho de busca. Maior que qualquer score posicional comum (~±200) e que a
// repetição perca pra qualquer linha que progrida, mas menor que uma derrota
// (−WIN_SCORE) — repetir ainda é "melhor" que perder.
const REPEAT_PENALTY = 500;
// Janela máxima de posições anteriores consideradas na detecção de repetição.
// Como a profundidade de busca é ≤ 4, o caminho nunca passa de 8 posições.
const HISTORY_LIMIT = 8;
// Quantos lances do root coletar pra a regra anti-repetição (#3).
const ROOT_TOP_K = 3;

// === Anti-pêndulo (recuos desnecessários do peão) ===
// O conserto do loop fez as partidas terminarem, mas o bot ainda balançava o
// peão (A→B→A) sem progredir quando estava vencendo: a busca adversária dá um
// valor alto a recuar/manter flexibilidade, e nada distinguia um recuo TOLO de
// um recuo FORÇADO. Penalidade direta sobre o recuo desnecessário resolve.
//
// Recuo = lance de peça que AUMENTA a distância BFS do peão ao próprio objetivo.
//   • DESNECESSÁRIO (punido): existe outro lance de peça que NÃO aumenta a
//     distância — havia saída pra frente e o bot escolheu voltar.
//   • FORÇADO (não punido): TODOS os lances de peça aumentam — o peão está
//     encurralado pelas paredes e recuar é o caminho mais curto disponível.
// Voltar a uma casa que ENCURTA o BFS nunca é recuo (é progresso legítimo).
//
// A distinção é exatamente o teste por BFS: dist(destino) > dist(atual) define o
// recuo; a existência de uma alternativa não-recuo define se foi desnecessário.
// Valor moderado: filtra o vai-e-vem tolo sem sobrepor uma vantagem tática real
// (que move o score em centenas/milhares).
const RETREAT_PENALTY = 120;

const rowOf = (idx: number): number => Math.floor(idx / BOARD_SIZE);
const colOf = (idx: number): number => idx % BOARD_SIZE;
const pieceOf = (state: GameState, id: PlayerId): number =>
  id === 1 ? state.p1 : state.p2;

// Hash de uma posição pra detecção de repetição: peões + vez + paredes.
// Paredes só são ADICIONADAS ao longo do jogo, então a ordem dos placements é
// estável dentro de uma mesma busca (todo descendente herda o prefixo do nó
// raiz) — basta concatenar, sem ordenar.
const positionHash = (state: GameState): string => {
  let walls = "";
  for (const p of state.walls.placements) {
    walls += `${p.type}${p.interRow},${p.interCol};`;
  }
  return `${state.p1}.${state.p2}.${state.turn}.${walls}`;
};

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
  // Termo de PROGRESSO absoluto: recompensa estar perto do próprio objetivo,
  // independentemente do adversário. Sem ele, posições de saldo relativo igual
  // viram platôs (andar não muda o score) — a origem dos ciclos. Com ele, o bot
  // sempre prefere avançar mesmo quando a posição relativa é neutra.
  const progressScore = (MAX_DIST - botDist) * 3;
  const wallScore = (state.wallsLeft[botId] - state.wallsLeft[humanId]) * 1;
  return distScore + progressScore + wallScore;
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

// Campo de distância BFS até a linha-objetivo pra TODAS as casas, numa única
// varredura multi-source a partir da linha-alvo. Custa UM BFS por nó e devolve a
// distância de qualquer casa por lookup — bem mais barato que um BFS por lance.
// Casa inalcançável fica -1.
const distFieldToGoal = (state: GameState, targetRow: number): Int16Array => {
  const walls = state.walls;
  const field = new Int16Array(TOTAL_SQUARES).fill(-1);
  let frontier: number[] = [];
  for (let c = 0; c < BOARD_SIZE; c++) {
    const cell = targetRow * BOARD_SIZE + c;
    field[cell] = 0;
    frontier.push(cell);
  }
  let d = 0;
  while (frontier.length > 0) {
    d++;
    const next: number[] = [];
    for (const cur of frontier) {
      const r = (cur / BOARD_SIZE) | 0;
      const c = cur % BOARD_SIZE;
      if (r > 0) { const n = cur - BOARD_SIZE; if (field[n] < 0 && !isBlocked(walls, cur, n)) { field[n] = d; next.push(n); } }
      if (r < BOARD_SIZE - 1) { const n = cur + BOARD_SIZE; if (field[n] < 0 && !isBlocked(walls, cur, n)) { field[n] = d; next.push(n); } }
      if (c > 0) { const n = cur - 1; if (field[n] < 0 && !isBlocked(walls, cur, n)) { field[n] = d; next.push(n); } }
      if (c < BOARD_SIZE - 1) { const n = cur + 1; if (field[n] < 0 && !isBlocked(walls, cur, n)) { field[n] = d; next.push(n); } }
    }
    frontier = next;
  }
  return field;
};

// Anti-pêndulo: para o nó onde o BOT vai mover, devolve uma função que dá a
// penalidade de RECUO de cada destino de peça. Um campo de distância (1 BFS) diz
// a distância de cada casa; um destino só é punido se afasta do objetivo
// (dist maior que a atual) E existe algum lance de peça que NÃO afasta (recuo
// desnecessário). Recuo forçado (todos afastam) passa livre.
const retreatPenalty = (
  state: GameState,
  botId: PlayerId,
  moves: Move[],
): ((to: number) => number) => {
  const field = distFieldToGoal(state, goalRow(botId));
  const myDist = field[pieceOf(state, botId)];
  let hasNonRetreat = false;
  for (const mv of moves) {
    if (mv.kind !== "piece") continue;
    const d = field[mv.to];
    if (d >= 0 && d <= myDist) { hasNonRetreat = true; break; }
  }
  return (to: number): number =>
    field[to] > myDist && hasNonRetreat ? RETREAT_PENALTY : 0;
};

// Avalia o estado-filho recursando no minimax — mas se `child` recria uma
// posição já presente no caminho de busca (`history`), corta a linha como um
// EMPATE por repetição em vez de recursar (#1).
//
// Valor de repetição = −REPEAT_PENALTY na ótica do BOT, SEMPRE (independe de
// quem moveu). É "contempt": repetir é ruim pro bot. Num nó MAX (bot decidindo)
// o maximizador foge da repetição se houver QUALQUER linha que progrida; num nó
// MIN (adversário) o minimizador busca a repetição — modela certo um oponente
// que força empate quando está perdendo. Assim NENHUM dos bots fecha o ciclo
// voluntariamente quando existe alternativa que avança.
//
// (O bug original assinava o valor por quem moveu: numa repetição de período 4
// quem fecha o ciclo é o adversário, então o bot pontuava +REPEAT_PENALTY e
// AMAVA o ciclo — exatamente o que perpetuava o loop.)
const scoreChild = (
  child: GameState,
  depth: number,
  alpha: number,
  beta: number,
  childIsMax: boolean,
  botId: PlayerId,
  humanId: PlayerId,
  history: Set<string>,
): number => {
  const hash = positionHash(child);
  if (history.has(hash)) {
    return -REPEAT_PENALTY;
  }
  // Atualiza o histórico a cada nó (entra ao descer, sai ao subir) e respeita a
  // janela de HISTORY_LIMIT posições.
  const added = history.size < HISTORY_LIMIT;
  if (added) history.add(hash);
  const score = minimax(child, depth - 1, alpha, beta, childIsMax, botId, humanId, history);
  if (added) history.delete(hash);
  return score;
};

const minimax = (
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMax: boolean,
  botId: PlayerId,
  humanId: PlayerId,
  history: Set<string>,
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
    // Penalidade de recuo desnecessário do peão do bot neste nó (anti-pêndulo).
    const penalty = retreatPenalty(turned, botId, moves);
    for (const move of moves) {
      const res = applyMove(turned, player, move);
      if (!res.ok) continue;
      explored = true;
      const pen = move.kind === "piece" ? penalty(move.to) : 0;
      const score = scoreChild(res.state, depth, alpha, beta, false, botId, humanId, history) - pen;
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
    const score = scoreChild(res.state, depth, alpha, beta, true, botId, humanId, history);
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

  // Histórico do CAMINHO de busca. NÃO persiste entre chamadas — botMove segue
  // sendo função pura do estado (determinística e segura pra partidas
  // concorrentes no server). Semeado com a posição-raiz pra que qualquer linha
  // que volte à posição atual dentro do horizonte seja detectada como ciclo.
  const history = new Set<string>([positionHash(turned)]);

  // #3: coleta o score de TODOS os lances do root e escolhe entre os top-K.
  // Mantém a poda α-β (alpha sobe com o melhor encontrado): num nó MAX o melhor
  // lance sai exato — só o ranking de 2º/3º vira aproximado, o que não afeta a
  // escolha (só pegamos o melhor não-repetido). Repetições recebem score exato
  // (−REPEAT_PENALTY) sem recursão.
  // Penalidade de recuo desnecessário do peão no root (anti-pêndulo) — mesma
  // regra das camadas internas, agora sobre a decisão real do bot.
  const penalty = retreatPenalty(turned, botId, moves);
  const scored: Array<{ move: Move; score: number }> = [];
  let alpha = -Infinity;
  for (const move of moves) {
    const res = applyMove(turned, botId, move);
    if (!res.ok) continue;
    const hash = positionHash(res.state);
    let score: number;
    if (history.has(hash)) {
      score = -REPEAT_PENALTY; // bot recriando a posição → fortemente evitado
    } else {
      const pen = move.kind === "piece" ? penalty(move.to) : 0;
      history.add(hash);
      score = minimax(res.state, depth - 1, alpha, Infinity, false, botId, humanId, history) - pen;
      history.delete(hash);
    }
    scored.push({ move, score });
    if (score > alpha) alpha = score;
  }

  if (scored.length > 0) {
    // Ordena por score desc. Array.sort é ESTÁVEL → em empate mantém a ordem de
    // generateMoves (peças antes de paredes) = mesmo desempate determinístico
    // de antes. Entre os top-K, força o melhor lance que NÃO seja repetição;
    // se todos repetirem (bot encurralado), fica com o melhor mesmo assim.
    scored.sort((a, b) => b.score - a.score);
    const topK = scored.slice(0, ROOT_TOP_K);
    const chosen = topK.find((c) => c.score > -REPEAT_PENALTY) ?? topK[0];
    return chosen.move;
  }

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
