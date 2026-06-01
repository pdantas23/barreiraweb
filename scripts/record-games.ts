// =============================================================================
// record-games.ts — grava partidas do Barreira como vídeo MP4
// =============================================================================
//
// Script STANDALONE: sem browser, sem servidor, sem React. Simula partidas
// completas (bot médio vs bot difícil) reusando a engine pura de
// @barreira/shared, renderiza cada estado do tabuleiro como frame PNG com
// node-canvas e monta os frames em MP4 via FFmpeg.
//
// Uso:
//   npx tsx scripts/record-games.ts --count 10
//
// Pré-requisitos:
//   - FFmpeg instalado no sistema (checado no início).
//   - Dependências instaladas:  cd scripts && npm install
//
// Saída:
//   scripts/output/barreira_partida_01.mp4, barreira_partida_02.mp4, ...
//
// O VISUAL é uma cópia fiel do tabuleiro do frontend (web/src): as cores,
// proporções e a lógica de posicionamento de células, peões e paredes foram
// extraídas de web/src/gameColors.ts, web/src/components/{Board,Square,Piece,
// Wall}.tsx e web/src/hooks/useResponsiveBoard.ts. Nada de visual foi
// inventado — só foi escalado para 1920x1920.
// =============================================================================

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas } from "canvas";

// Engine pura reusada via path relativo (NÃO via workspace).
import {
  BOARD_SIZE,
  applyMove,
  botMove,
  col,
  getValidMoves,
  initialState,
  row,
  type BotDifficulty,
  type GameState,
  type Move,
  type PlayerId,
} from "../shared/src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");
const TMP_DIR = join(__dirname, "tmp");

// === Parâmetros do vídeo ====================================================
const CANVAS_SIZE = 1920; // resolução final (quadrada)
const FRAME_MS = 800; // cada jogada fica visível ~800ms
const INPUT_FPS = 1000 / FRAME_MS; // 1.25 fps de entrada → 800ms por PNG
const OUTPUT_FPS = 25; // fps de saída (players lidam melhor com 25)
const HOLD_FINAL_FRAMES = 3; // segura o frame final por mais ~2.4s

// === Parâmetros da simulação ================================================
const P1_DIFFICULTY: BotDifficulty = "medium"; // bot médio = jogador 1 (azul)
const P2_DIFFICULTY: BotDifficulty = "hard"; // bot difícil = jogador 2 (vermelho)
const MAX_PLIES = 300; // trava de segurança contra partidas infinitas

// =============================================================================
// PALETA — copiada fielmente de web/src/gameColors.ts (não inventar visual).
// =============================================================================
const gc = {
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",

  boardBg: "#FFFFFF",
  boardBgEnd: "#F5F7FF",
  boardShadow: "#3D6FFF",
  boardRadius: 16,

  cell: "#EEF2FF",
  cellBorder: "#DDEAFF",
  cellRadius: 8,

  goalPlayer: ["#3D6FFF", "#6B9FFF"] as const,
  goalOpponent: ["#FF3D6F", "#FF6B9F"] as const,

  pawnPlayer: ["#3D6FFF", "#6B9FFF"] as const,
  pawnOpponent: ["#FF3D6F", "#FF6B9F"] as const,
  pawnOuter: "#FFFFFF",
  pawnReflect: "rgba(255,255,255,0.3)",

  blue: "#3D6FFF",
  red: "#FF3D6F",
} as const;

// =============================================================================
// LAYOUT — proporções idênticas a web/src/hooks/useResponsiveBoard.ts,
// escaladas do board de referência (600px) para o canvas 1920x1920.
//
// Referência web (board = 600): padding=2, gap=5, wallThickness=6.
// Mantemos as MESMAS razões em relação ao tamanho do tabuleiro.
// =============================================================================
const REF_BOARD = 600;
const BOARD = 1500; // tabuleiro interno no canvas
const S = BOARD / REF_BOARD; // fator de escala (2.5)

const PADDING = 2 * S; // BOARD_PADDING
const GAP = 5 * S; // GAP entre células
const WALL_THICKNESS = 6 * S; // WALL_THICKNESS
const INNER = BOARD - PADDING * 2 - GAP * (BOARD_SIZE - 1);
const SQUARE = INNER / BOARD_SIZE; // squareSize (float p/ encaixe exato)
const CELL = SQUARE + GAP; // cellSize (passo entre casas)

const CARD = BOARD + 12 * S; // card = boardSize + 12 (Board.tsx)
const CARD_MARGIN = 6 * S; // metade do +12, sobra de cada lado
const CARD_RADIUS = gc.boardRadius * S;
const CELL_RADIUS = gc.cellRadius * S;
const GOAL_HEIGHT = 10 * S; // goalHeight (Board.tsx)

// Card centralizado no canvas; tabuleiro interno deslocado pela margem.
const CARD_X = (CANVAS_SIZE - CARD) / 2;
const CARD_Y = (CANVAS_SIZE - CARD) / 2;
const BOARD_X = CARD_X + CARD_MARGIN;
const BOARD_Y = CARD_Y + CARD_MARGIN;

// =============================================================================
// Helpers de cor
// =============================================================================

// "#RRGGBB" + alpha (0..1) → "rgba(r,g,b,a)".
const hexA = (hex: string, alpha: number): string => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

type Ctx = import("canvas").CanvasRenderingContext2D;

const roundRectPath = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
};

// Centro (px) da casa `index`, espelhando piecePos() de Board.tsx.
const cellCenter = (index: number): { cx: number; cy: number } => {
  const r = row(index);
  const c = col(index);
  return {
    cx: BOARD_X + PADDING + c * CELL + SQUARE / 2,
    cy: BOARD_Y + PADDING + r * CELL + SQUARE / 2,
  };
};

// =============================================================================
// Renderização do tabuleiro (cópia fiel dos componentes web)
// =============================================================================

const renderState = (state: GameState): Buffer => {
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext("2d");

  // --- Fundo da página: gradiente bgTop → bgBottom (Game/GameLayout) ---
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_SIZE);
  bg.addColorStop(0, gc.bgTop);
  bg.addColorStop(1, gc.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // --- Card do tabuleiro: sombra + gradiente boardBg → boardBgEnd ---
  ctx.save();
  ctx.shadowColor = hexA(gc.boardShadow, 0.12); // boxShadow 0 4px 20px shadow1f
  ctx.shadowBlur = 20 * S;
  ctx.shadowOffsetY = 4 * S;
  const cardGrad = ctx.createLinearGradient(0, CARD_Y, 0, CARD_Y + CARD);
  cardGrad.addColorStop(0, gc.boardBg);
  cardGrad.addColorStop(1, gc.boardBgEnd);
  ctx.fillStyle = cardGrad;
  roundRectPath(ctx, CARD_X, CARD_Y, CARD, CARD, CARD_RADIUS);
  ctx.fill();
  ctx.restore();

  // --- Casas (Square.tsx): fill gc.cell, borda gc.cellBorder ---
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const r = row(i);
    const c = col(i);
    const x = BOARD_X + PADDING + c * CELL;
    const y = BOARD_Y + PADDING + r * CELL;
    roundRectPath(ctx, x, y, SQUARE, SQUARE, CELL_RADIUS);
    ctx.fillStyle = gc.cell;
    ctx.fill();
    ctx.lineWidth = 0.5 * S;
    ctx.strokeStyle = gc.cellBorder;
    ctx.stroke();
  }

  // --- Zonas de objetivo (Board.tsx), z-index 5, alpha 0x33 ≈ 0.2 ---
  drawGoalZone(ctx, BOARD_Y + PADDING, gc.goalOpponent); // topo = oponente (vermelho)
  drawGoalZone(
    ctx,
    BOARD_Y + BOARD - PADDING - GOAL_HEIGHT,
    gc.goalPlayer, // base = jogador (azul)
  );

  // --- Paredes (Wall.tsx), z-index 10 ---
  for (const p of state.walls.placements) {
    drawWall(ctx, p.type, p.interRow, p.interCol, p.owner);
  }

  // --- Peões (Piece.tsx), z-index 15 (acima das paredes) ---
  drawPiece(ctx, state.p1, 1);
  drawPiece(ctx, state.p2, 2);

  return canvas.toBuffer("image/png");
};

const drawGoalZone = (
  ctx: Ctx,
  top: number,
  colors: readonly [string, string],
): void => {
  const x = BOARD_X + PADDING;
  const w = BOARD - PADDING * 2;
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, hexA(colors[0], 0.2));
  grad.addColorStop(1, hexA(colors[1], 0.2));
  ctx.fillStyle = grad;
  roundRectPath(ctx, x, top, w, GOAL_HEIGHT, CELL_RADIUS);
  ctx.fill();
};

const drawWall = (
  ctx: Ctx,
  type: "h" | "v",
  ir: number,
  ic: number,
  owner: PlayerId | undefined,
): void => {
  const color = owner === 2 ? gc.red : gc.blue; // colorFor() de Wall.tsx

  let x: number, y: number, w: number, h: number;
  if (type === "h") {
    x = BOARD_X + PADDING + ic * CELL;
    y = BOARD_Y + PADDING + (ir + 1) * CELL - GAP / 2 - WALL_THICKNESS / 2;
    w = SQUARE * 2 + GAP;
    h = WALL_THICKNESS;
  } else {
    x = BOARD_X + PADDING + (ic + 1) * CELL - GAP / 2 - WALL_THICKNESS / 2;
    y = BOARD_Y + PADDING + ir * CELL;
    w = WALL_THICKNESS;
    h = SQUARE * 2 + GAP;
  }

  ctx.save();
  ctx.shadowColor = hexA(gc.boardShadow, 0.25); // boxShadow 0 1px 3px shadow40
  ctx.shadowBlur = 3 * S;
  ctx.shadowOffsetY = 1 * S;
  ctx.fillStyle = color;
  roundRectPath(ctx, x, y, w, h, 3 * S);
  ctx.fill();
  ctx.restore();
};

const drawPiece = (ctx: Ctx, index: number, player: PlayerId): void => {
  const { cx, cy } = cellCenter(index);
  const colors = player === 1 ? gc.pawnPlayer : gc.pawnOpponent;
  const d = SQUARE * 0.72; // Piece.tsx
  const reflectD = d * 0.28;

  // Anel externo branco com sombra (boxShadow 0 3px 6px rgba(0,0,0,0.2)).
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.2)";
  ctx.shadowBlur = 6 * S;
  ctx.shadowOffsetY = 3 * S;
  ctx.fillStyle = gc.pawnOuter;
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Disco interno: linear-gradient(135deg, colors[0], colors[1]).
  const innerR = (d - 4 * S) / 2;
  const grad = ctx.createLinearGradient(
    cx - innerR,
    cy - innerR,
    cx + innerR,
    cy + innerR,
  );
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();

  // Reflexo: círculo claro deslocado p/ cima-esquerda (top d*0.12, left d*0.15).
  const reflectCx = cx - d / 2 + d * 0.15 + reflectD / 2;
  const reflectCy = cy - d / 2 + d * 0.12 + reflectD / 2;
  ctx.fillStyle = gc.pawnReflect;
  ctx.beginPath();
  ctx.arc(reflectCx, reflectCy, reflectD / 2, 0, Math.PI * 2);
  ctx.fill();
};

// =============================================================================
// Simulação de uma partida
// =============================================================================

const difficultyOf = (player: PlayerId): BotDifficulty =>
  player === 1 ? P1_DIFFICULTY : P2_DIFFICULTY;

const randInt = (n: number): number => Math.floor(Math.random() * n);

// Joga um lance de peça aleatório (válido) para `player`. Usado só na abertura,
// para diversificar partidas — os bots são determinísticos, então sem isso as
// N gravações seriam idênticas. O grosso da partida é sempre botMove().
const randomPawnMove = (state: GameState, player: PlayerId): Move | null => {
  const moves = getValidMoves(state, player);
  if (moves.length === 0) return null;
  return { kind: "piece", to: moves[randInt(moves.length)] };
};

type SimResult = { states: GameState[]; winner: PlayerId | null; plies: number };

// Retorna a sequência de estados (incluindo o inicial) — um por jogada.
const simulateGame = (): SimResult => {
  const firstTurn: PlayerId = Math.random() < 0.5 ? 1 : 2;
  let state = initialState(firstTurn);
  const states: GameState[] = [state];

  // Abertura aleatória curta (0..6 meios-lances de peça) só p/ diversificar.
  const openingPlies = randInt(7);
  for (let i = 0; i < openingPlies && state.winner === null; i++) {
    const move = randomPawnMove(state, state.turn);
    if (!move) break;
    const res = applyMove(state, state.turn, move);
    if (!res.ok) break;
    state = res.state;
    states.push(state);
  }

  // Resto da partida: bot médio vs bot difícil via botMove().
  let plies = states.length - 1;
  while (state.winner === null && plies < MAX_PLIES) {
    const player = state.turn;
    const move = botMove(state, player, difficultyOf(player));
    if (!move) break; // estado degenerado — encerra
    const res = applyMove(state, player, move);
    if (!res.ok) break; // não deve acontecer (botMove só retorna lance legal)
    state = res.state;
    states.push(state);
    plies++;
  }

  return { states, winner: state.winner, plies };
};

// =============================================================================
// FFmpeg
// =============================================================================

const ensureFfmpeg = (): void => {
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (probe.error || probe.status !== 0) {
    console.error(
      "\n✖ FFmpeg não encontrado no sistema.\n" +
        "  Este script precisa do FFmpeg instalado e disponível no PATH.\n" +
        "  Instale com:\n" +
        "    macOS:         brew install ffmpeg\n" +
        "    Debian/Ubuntu: sudo apt-get install ffmpeg\n",
    );
    process.exit(1);
  }
};

// Monta os PNGs de `frameDir` num MP4 em `outPath`.
const encodeVideo = (frameDir: string, outPath: string): void => {
  const args = [
    "-y",
    "-framerate",
    String(INPUT_FPS),
    "-i",
    join(frameDir, "frame_%04d.png"),
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "10",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(OUTPUT_FPS),
    outPath,
  ];
  const res = spawnSync("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  if (res.status !== 0) {
    const stderr = res.stderr ? res.stderr.toString() : "";
    throw new Error(`FFmpeg falhou ao montar ${outPath}\n${stderr}`);
  }
};

// =============================================================================
// CLI
// =============================================================================

const parseCount = (argv: string[]): number => {
  const idx = argv.indexOf("--count");
  if (idx === -1) {
    console.error(
      "\n✖ Parâmetro obrigatório ausente: --count\n" +
        "  Uso: npx tsx scripts/record-games.ts --count <N>\n" +
        "  Exemplo: npx tsx scripts/record-games.ts --count 10\n",
    );
    process.exit(1);
  }
  const raw = argv[idx + 1];
  const count = Number(raw);
  if (!raw || !Number.isInteger(count) || count <= 0) {
    console.error(
      `\n✖ Valor inválido para --count: ${JSON.stringify(raw)}\n` +
        "  Esperado um inteiro positivo. Ex.: --count 10\n",
    );
    process.exit(1);
  }
  return count;
};

const main = (): void => {
  const count = parseCount(process.argv.slice(2));

  ensureFfmpeg();

  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });

  console.log(
    `\nBarreira — gravando ${count} partida(s): bot ${P1_DIFFICULTY} (azul) vs bot ${P2_DIFFICULTY} (vermelho)\n`,
  );

  for (let g = 1; g <= count; g++) {
    const pad = String(g).padStart(2, "0");
    const prefix = `Partida ${g}/${count}`;

    process.stdout.write(`${prefix} — simulando...`);
    const { states, winner, plies } = simulateGame();

    process.stdout.write(" renderizando frames...");
    const frameDir = join(TMP_DIR, `partida_${pad}`);
    rmSync(frameDir, { recursive: true, force: true });
    mkdirSync(frameDir, { recursive: true });

    let frameNo = 0;
    const writeFrame = (buf: Buffer) => {
      const name = `frame_${String(frameNo).padStart(4, "0")}.png`;
      writeFileSync(join(frameDir, name), buf);
      frameNo++;
    };

    for (const state of states) writeFrame(renderState(state));
    // Segura o frame final por mais alguns frames p/ o desfecho respirar.
    const finalBuf = renderState(states[states.length - 1]);
    for (let i = 0; i < HOLD_FINAL_FRAMES; i++) writeFrame(finalBuf);

    process.stdout.write(" montando vídeo...");
    const outPath = join(OUTPUT_DIR, `barreira_partida_${pad}.mp4`);
    encodeVideo(frameDir, outPath);

    // Limpa os PNGs temporários desta partida.
    rmSync(frameDir, { recursive: true, force: true });

    const result =
      winner === null ? "sem vencedor (limite de lances)" : `vencedor: jogador ${winner}`;
    console.log(
      ` concluído ✓  (${plies} lances, ${result}) → output/barreira_partida_${pad}.mp4`,
    );
  }

  console.log(`\n✓ ${count} vídeo(s) em scripts/output/\n`);
};

main();
