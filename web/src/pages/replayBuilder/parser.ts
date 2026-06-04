// === Parser do script de partida pro Replay Builder.
//
// Formato aceito (uma linha por unidade de tempo, multi-jogadores separados
// por "|"):
//
//   0:01 | P2: e4 ➔ d4
//   0:03 | P2: d4 ➔ d5 | P1: e8 ➔ e7
//   0:08 | P2: Barreira Horizontal entre e-f (Linhas 1/2)
//   0:35 | P2: c5 ➔ d5 | P1: Pula o adversário de e5 para c5
//   0:54 | P1: g2 ➔ g1 (Fim de jogo / Vitória do Azul)
//
// Toleramos:
//   - Setas ASCII "->", "=>" e "➔"
//   - "Barreira H" / "Barreira V" abreviados
//   - Timestamps opcionais (linhas sem prefixo "X:YY |" tambem parseiam)
//   - Comentarios entre parenteses no final de uma acao (sao ignorados)
//   - Linhas em branco e linhas iniciando com "#" (comentarios)

import type { Move, PlayerId } from "@barreira/shared";
import { parseCell, parseWallSpec } from "./coord";

export type ParsedAction = {
  player: PlayerId;
  move: Move;
  /** Texto cru da acao pra mostrar no painel lateral. */
  raw: string;
  /** Linha do script (1-indexed) em que essa acao aparece. */
  lineNumber: number;
};

export type ParseError = {
  lineNumber: number;
  reason: string;
};

export type ParseResult =
  | { ok: true; actions: ParsedAction[] }
  | { ok: false; errors: ParseError[]; actions: ParsedAction[] };

const PIECE_MOVE_RE = /^([a-iA-I]\d)\s*(?:➔|->|=>|→)\s*([a-iA-I]\d)/;
// "Pula o adversário de X para Y" — aceita ":" opcional depois de adversario
const JUMP_RE = /^Pula\s+o\s+advers[áa]rio\s*:?\s+de\s+([a-iA-I]\d)\s+para\s+([a-iA-I]\d)/i;
// "Barreira H entre/em c-d (Linhas 4/5)" — aceita "entre" ou "em"
const WALL_RE = /^Barreira\s+(Horizontal|H|Vertical|V)\s+(?:entre|em)\s+([a-iA-I]\s*-\s*[a-iA-I])\s*\(\s*Linhas?\s+(\d\s*\/\s*\d)\s*\)/i;

const stripParensTail = (s: string): string => {
  // Remove "(...)" no final (comentarios tipo "(Fim de jogo / ...)"), mas
  // NUNCA strip se o conteudo começa com "Linhas" — isso eh parte da spec
  // da parede ("Barreira H em c-d (Linhas 6/7)") e tem que ficar pro WALL_RE.
  return s.replace(/\s*\((?!Linhas?\b)[^)]*\)\s*$/i, "").trim();
};

const parsePlayerTag = (tag: string): PlayerId | null => {
  const t = tag.trim().toUpperCase();
  if (t === "P1") return 1;
  if (t === "P2") return 2;
  return null;
};

const parseAction = (
  player: PlayerId,
  raw: string,
  lineNumber: number,
): { ok: true; action: ParsedAction } | { ok: false; reason: string } => {
  const text = stripParensTail(raw);

  // Movimento normal "e4 ➔ d4"
  const piece = text.match(PIECE_MOVE_RE);
  if (piece) {
    const to = parseCell(piece[2]);
    if (to === null) return { ok: false, reason: `Coordenada destino invalida: "${piece[2]}"` };
    return {
      ok: true,
      action: { player, move: { kind: "piece", to }, raw: text, lineNumber },
    };
  }

  // Salto "Pula o adversario de X para Y"
  const jump = text.match(JUMP_RE);
  if (jump) {
    const to = parseCell(jump[2]);
    if (to === null) return { ok: false, reason: `Coordenada destino do salto invalida: "${jump[2]}"` };
    return {
      ok: true,
      action: { player, move: { kind: "piece", to }, raw: text, lineNumber },
    };
  }

  // Parede "Barreira H entre c-d (Linhas 6/7)"
  const wall = text.match(WALL_RE);
  if (wall) {
    const type: "h" | "v" = wall[1][0].toLowerCase() === "h" ? "h" : "v";
    const spec = parseWallSpec(wall[2], wall[3]);
    if (!spec) return { ok: false, reason: `Especificacao da parede invalida: "${text}"` };
    return {
      ok: true,
      action: {
        player,
        move: {
          kind: "wall",
          placement: { type, interCol: spec.interCol, interRow: spec.interRow },
        },
        raw: text,
        lineNumber,
      },
    };
  }

  return { ok: false, reason: `Acao nao reconhecida: "${text}"` };
};

export const parseGameScript = (script: string): ParseResult => {
  const actions: ParsedAction[] = [];
  const errors: ParseError[] = [];

  const lines = script.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    let line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    // Remove timestamp "0:01 | " do inicio se existir
    const tsMatch = line.match(/^\d{1,2}:\d{2}\s*\|\s*/);
    if (tsMatch) line = line.slice(tsMatch[0].length);

    // Quebra por "|" — cada segmento eh uma acao de um jogador
    const segments = line.split("|").map((s) => s.trim()).filter(Boolean);
    for (const seg of segments) {
      // Cada segmento eh "P1: ..." ou "P2: ..." (com anotacao opcional
      // de cor entre parenteses, tipo "P2 (Vermelho): ...").
      const m = seg.match(/^(P[12])(?:\s*\([^)]*\))?\s*:\s*(.+)$/i);
      if (!m) {
        errors.push({ lineNumber, reason: `Segmento sem prefixo "P1:" ou "P2:": "${seg}"` });
        continue;
      }
      const player = parsePlayerTag(m[1]);
      if (player === null) {
        errors.push({ lineNumber, reason: `Jogador invalido: "${m[1]}"` });
        continue;
      }
      const result = parseAction(player, m[2], lineNumber);
      if (!result.ok) {
        errors.push({ lineNumber, reason: result.reason });
      } else {
        actions.push(result.action);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, actions };
  }
  return { ok: true, actions };
};
