// Roteiro do tutorial — partida guiada interativa (mobile).
//
// A engine de @barreira/shared é a fonte da verdade pros lances válidos e pros
// destaques: o roteiro só diz O QUE pedir; getValidMoves/canPlaceWall dizem o
// que é legal. Mantido puro (sem React) pra ser testável isoladamente.

import {
  getValidMoves,
  goalRow,
  row,
  type GameState,
  type Move,
  type PlayerId,
} from "@barreira/shared";

// HUMANO = peão 1 (embaixo, linha 8, objetivo linha 0 / topo).
// OPONENTE = peão 2 (em cima, linha 0, objetivo linha 8).
export const TUTORIAL_HUMAN: PlayerId = 1;
export const TUTORIAL_OPPONENT: PlayerId = 2;

export type TutorialStepKind = "info" | "move" | "wall";

export type TutorialStep = {
  id: string;
  kind: TutorialStepKind;
  /** Texto da instrução. */
  text: string;
  /** Rótulo do botão de avanço (só usado em passos "info"). */
  cta?: string;
  /** move: casas que o tutorial aceita/destaca (subconjunto dos lances válidos). */
  targets?: number[];
  /** wall: destacar o banco de paredes. */
  highlightWallBank?: boolean;
  /** info: destacar a linha-objetivo do topo (reforço visual). */
  highlightGoal?: boolean;
};

// A partir do início (peão 1 em 76 = linha 8, col 4), avançar uma casa = 67
// (linha 7, col 4). Determinístico: o tutorial sempre começa com o humano.
const FORWARD_FROM_START = 67;

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "intro",
    kind: "info",
    text: "Bem-vindo ao Barreira! Você é o peão azul, embaixo. Vou te ensinar o básico em 30 segundos.",
    cta: "Começar",
  },
  {
    id: "move",
    kind: "move",
    text: "Toque na casa destacada para avançar o seu peão.",
    targets: [FORWARD_FROM_START],
  },
  {
    id: "goal",
    kind: "info",
    text: "Seu objetivo é alcançar a linha do topo. Quem chega na linha adversária primeiro vence a partida.",
    highlightGoal: true,
    cta: "Entendi",
  },
  {
    id: "wall",
    kind: "wall",
    text: "Agora arraste uma parede do banco (embaixo) e solte entre as casas para atrapalhar o oponente.",
    highlightWallBank: true,
  },
  {
    id: "wall-rule",
    kind: "info",
    text: "Boa! Paredes atrasam o oponente — mas o jogo nunca deixa fechar totalmente o caminho dele até o objetivo.",
    cta: "Quase lá",
  },
  {
    id: "free-play",
    kind: "info",
    text: "Pronto! Agora é com você: termine esta partida chegando na linha do topo.",
    cta: "Jogar",
  },
];

/**
 * Lance "de mentira" do oponente durante o tutorial: anda em direção ao próprio
 * objetivo (linha de baixo) pelo lance válido que mais o aproxima. Devolve a vez
 * pro humano via engine real, sem bot pensando. Determinístico. null se não
 * houver lance (não deve acontecer no roteiro de tabuleiro aberto).
 */
export const scriptedOpponentMove = (state: GameState): Move | null => {
  const moves = getValidMoves(state, TUTORIAL_OPPONENT);
  if (moves.length === 0) return null;
  const goal = goalRow(TUTORIAL_OPPONENT); // 8 (linha de baixo)
  let best = moves[0];
  for (const m of moves) {
    if (Math.abs(row(m) - goal) < Math.abs(row(best) - goal)) best = m;
  }
  return { kind: "piece", to: best };
};

/**
 * Casas que o tutorial aceita/destaca num passo "move": interseção entre os
 * alvos do roteiro e os lances realmente válidos no estado atual (defensivo —
 * nunca destaca uma casa ilegal mesmo que o roteiro erre).
 */
export const allowedTargets = (state: GameState, step: TutorialStep): number[] => {
  if (step.kind !== "move" || !step.targets) return [];
  const valid = new Set(getValidMoves(state, TUTORIAL_HUMAN));
  return step.targets.filter((t) => valid.has(t));
};
