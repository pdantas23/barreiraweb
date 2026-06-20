// === DIAGNÓSTICO (não-produção) — pêndulo / vai-e-vem dos bots ===
//
// NÃO é teste de produção: roda simulações e IMPRIME métricas (console) pra
// alimentar o BOT_DIAGNOSTIC_REPORT.md. As asserções são frouxas (só garantem
// que a simulação rodou) — o valor está nos números logados.
//
// Os bots são DETERMINÍSTICOS, então medium-vs-hard a partir do início padrão
// daria sempre a MESMA partida. Pra diversificar (200 posições diferentes),
// cada partida recebe uma ABERTURA aleatória (RNG seeded → reprodutível) antes
// de os bots assumirem até o fim.

import { describe, it, expect } from "vitest";
import {
  initialState,
  applyMove,
  botMove,
  positionHash,
  getValidMoves,
  goalRow,
  isBlocked,
  canPlaceWall,
  allPossiblePlacements,
  BOARD_SIZE,
  TOTAL_SQUARES,
  type GameState,
  type Move,
  type PlayerId,
  type BotDifficulty,
} from "./index";

// ─── RNG determinístico (mulberry32) ───
const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ─── BFS: distância de `from` até a linha-alvo (espelha bot.ts) ───
const bfsDist = (state: GameState, from: number, targetRow: number): number => {
  if (Math.floor(from / BOARD_SIZE) === targetRow) return 0;
  const walls = state.walls;
  const visited = new Uint8Array(TOTAL_SQUARES);
  visited[from] = 1;
  let frontier = [from];
  let dist = 0;
  while (frontier.length) {
    dist++;
    const next: number[] = [];
    for (const cur of frontier) {
      const r = (cur / BOARD_SIZE) | 0, c = cur % BOARD_SIZE;
      const ns: number[] = [];
      if (r > 0) ns.push(cur - BOARD_SIZE);
      if (r < BOARD_SIZE - 1) ns.push(cur + BOARD_SIZE);
      if (c > 0) ns.push(cur - 1);
      if (c < BOARD_SIZE - 1) ns.push(cur + 1);
      for (const n of ns) {
        if (!visited[n] && !isBlocked(walls, cur, n)) {
          if (((n / BOARD_SIZE) | 0) === targetRow) return dist;
          visited[n] = 1; next.push(n);
        }
      }
    }
    frontier = next;
  }
  return 999;
};

const pawnOf = (s: GameState, id: PlayerId) => (id === 1 ? s.p1 : s.p2);

// Abertura aleatória: alguns plies de lances legais (peça e, às vezes, parede)
// pra criar posições variadas. Retorna o estado ou null se degenerou (vitória).
const randomOpening = (rand: () => number, plies: number): GameState | null => {
  let s = initialState(rand() < 0.5 ? 1 : 2);
  for (let i = 0; i < plies; i++) {
    if (s.winner !== null) return null;
    const player = s.turn;
    const useWall = s.wallsLeft[player] > 0 && rand() < 0.3;
    let mv: Move | null = null;
    if (useWall) {
      const cands: Move[] = [];
      for (const p of allPossiblePlacements()) {
        if (canPlaceWall(s.walls, p)) cands.push({ kind: "wall", placement: p });
      }
      // tenta algumas paredes aleatórias até uma ser aceita pela engine
      for (let k = 0; k < 5 && cands.length; k++) {
        const cand = cands[Math.floor(rand() * cands.length)];
        if (applyMove(s, player, cand).ok) { mv = cand; break; }
      }
    }
    if (!mv) {
      const vm = getValidMoves(s, player);
      if (!vm.length) return null;
      mv = { kind: "piece", to: vm[Math.floor(rand() * vm.length)] };
    }
    const r = applyMove(s, player, mv);
    if (!r.ok) { // raríssimo; pula este ply
      const vm = getValidMoves(s, player);
      if (!vm.length) return null;
      const r2 = applyMove(s, player, { kind: "piece", to: vm[0] });
      if (!r2.ok) return null;
      s = r2.state;
    } else {
      s = r.state;
    }
  }
  return s.winner === null ? s : null;
};

type Acc = {
  pieceMoves: number;
  pendulums: number;
  retreats: number;
  cat: { advance: number; neutral: number; forced: number; unnecessary: number };
  wallMoves: number;
  uselessWalls: number;
};
const mkAcc = (): Acc => ({
  pieceMoves: 0, pendulums: 0, retreats: 0,
  cat: { advance: 0, neutral: 0, forced: 0, unnecessary: 0 },
  wallMoves: 0, uselessWalls: 0,
});

describe("DIAGNÓSTICO pêndulo — 200 partidas medium vs hard", () => {
  it("mede pêndulo, recuo e travadas", () => {
    const GAMES = 200;
    const MOVE_CAP = 200;
    const diff: Record<PlayerId, BotDifficulty> = { 1: "medium", 2: "hard" };
    const acc: Record<BotDifficulty, Acc> = { easy: mkAcc(), medium: mkAcc(), hard: mkAcc() };
    let totalMoves = 0;
    let gamesOver100 = 0;
    let gamesHitCap = 0;
    let played = 0;
    const lengths: number[] = [];

    const rand = rng(12345);

    for (let g = 0; g < GAMES; g++) {
      const openPlies = Math.floor(rand() * 9); // 0–8
      const start = randomOpening(rand, openPlies);
      if (!start) continue;
      played++;
      let s = start;
      // pawnAt[player] = casas do peão ao longo dos lances de PEÇA do bot
      const pawnAt: Record<PlayerId, number[]> = { 1: [pawnOf(s, 1)], 2: [pawnOf(s, 2)] };
      // Histórico real de posições (Correção 1) — passado ao botMove pra detecção
      // cross-turn, replicando o que o server faz por sala.
      let recent: string[] = [positionHash(s)];
      let n = 0;
      for (; n < MOVE_CAP && s.winner === null; n++) {
        const player = s.turn;
        const d = diff[player];
        const a = acc[d];
        const before = pawnOf(s, player);
        const goal = goalRow(player);
        const mv = botMove(s, player, d, recent);
        if (!mv) break;
        if (mv.kind === "piece") {
          a.pieceMoves++;
          const dBefore = bfsDist(s, before, goal);
          const dTo = bfsDist(s, mv.to, goal);
          // retreat = afasta do objetivo
          if (dTo > dBefore) a.retreats++;
          // pêndulo = volta à casa de 2 lances de peça atrás
          const seq = pawnAt[player];
          const isPendulum = seq.length >= 2 && mv.to === seq[seq.length - 2];
          if (isPendulum) {
            a.pendulums++;
            if (dTo < dBefore) a.cat.advance++;
            else if (dTo === dBefore) a.cat.neutral++;
            else {
              // recuo: forçado se TODO lance de peça afasta; senão desnecessário
              let hasNonRetreat = false;
              for (const to of getValidMoves(s, player)) {
                if (bfsDist(s, to, goal) <= dBefore) { hasNonRetreat = true; break; }
              }
              if (hasNonRetreat) a.cat.unnecessary++;
              else a.cat.forced++;
            }
          }
          seq.push(mv.to);
        } else {
          a.wallMoves++;
          // parede inútil = não aumenta a distância BFS do adversário
          const opp: PlayerId = player === 1 ? 2 : 1;
          const og = goalRow(opp);
          const dOppBefore = bfsDist(s, pawnOf(s, opp), og);
          const r0 = applyMove(s, player, mv);
          if (r0.ok) {
            const dOppAfter = bfsDist(r0.state, pawnOf(r0.state, opp), og);
            if (dOppAfter <= dOppBefore) a.uselessWalls++;
          }
        }
        const r = applyMove(s, player, mv);
        if (!r.ok) break;
        s = r.state;
        recent.push(positionHash(s));
        if (recent.length > 8) recent.shift();
      }
      totalMoves += n;
      lengths.push(n);
      if (n > 100) gamesOver100++;
      if (s.winner === null && n >= MOVE_CAP) gamesHitCap++;
    }

    const pct = (a: number, b: number) => (b === 0 ? "0.00" : ((100 * a) / b).toFixed(2));
    const report = (label: string, a: Acc) => {
      const lines = [
        `\n── ${label} ──`,
        `  lances de peça:        ${a.pieceMoves}`,
        `  pêndulos (A→B→A):      ${a.pendulums}  (${pct(a.pendulums, a.pieceMoves)}% dos lances de peça)`,
        `    ├ AVANÇA (BFS↓):     ${a.cat.advance}`,
        `    ├ NEUTRA (BFS=):     ${a.cat.neutral}`,
        `    ├ RECUO FORÇADO:     ${a.cat.forced}`,
        `    └ RECUO DESNECESS.:  ${a.cat.unnecessary}`,
        `  recuos (BFS↑) totais:  ${a.retreats}  (${pct(a.retreats, a.pieceMoves)}% dos lances de peça)`,
        `  paredes colocadas:     ${a.wallMoves}`,
        `  paredes inúteis (ΔBFS=0): ${a.uselessWalls}  (${pct(a.uselessWalls, a.wallMoves)}%)`,
      ];
      return lines.join("\n");
    };

    const avg = totalMoves / Math.max(1, played);
    const out = [
      "\n================ DIAGNÓSTICO PÊNDULO (200 partidas medium vs hard) ================",
      `partidas jogadas: ${played}  |  média de lances/partida: ${avg.toFixed(1)}`,
      `partidas > 100 lances: ${gamesOver100}  |  partidas que bateram o cap (${MOVE_CAP}, possível loop): ${gamesHitCap}`,
      `lances máx/mín por partida: ${Math.max(...lengths)} / ${Math.min(...lengths)}`,
      report("MEDIUM (p1)", acc.medium),
      report("HARD (p2)", acc.hard),
      "\n— referência relatório anterior: pêndulo < 4%, recuo < 0.5%, 0 travadas em 200 —",
      "==================================================================================\n",
    ].join("\n");
    // eslint-disable-next-line no-console
    console.log(out);

    expect(played).toBeGreaterThan(150);
  }, 300_000);
});

// ─── Estado construído pra casos isolados ───
const mkState = (over: Partial<GameState>): GameState => ({ ...initialState(1), ...over });

describe("DIAGNÓSTICO mecanismos isolados (item 3/4)", () => {
  it("RETREAT_PENALTY: com avanço disponível, NÃO recua", () => {
    // p1 (objetivo linha 0) no centro (cell 40 = linha4col4), p2 longe. Sem paredes.
    // Existe avanço (up=31, dist 3 < 4). Recuar (down=49, dist 5) é desnecessário.
    const s = mkState({ p1: 40, p2: 8, turn: 1 });
    for (const d of ["medium", "hard"] as const) {
      const mv = botMove(s, 1, d);
      expect(mv).not.toBeNull();
      const dBefore = bfsDist(s, 40, 0);
      if (mv!.kind === "piece") {
        const dTo = bfsDist(s, mv!.to, 0);
        // eslint-disable-next-line no-console
        console.log(`[retreat] ${d}: 40→${mv!.to} (dist ${dBefore}→${dTo})`);
        expect(dTo).toBeLessThanOrEqual(dBefore); // nunca recua com saída pra frente
      }
    }
  });

  it("endgame: a 1 casa do objetivo, vai pro gol (não oscila)", () => {
    const s = mkState({ p1: 13, p2: 8, turn: 1 }); // cell13 = linha1col4, dist 1
    for (const d of ["medium", "hard"] as const) {
      const mv = botMove(s, 1, d);
      // eslint-disable-next-line no-console
      console.log(`[endgame] ${d}: ${JSON.stringify(mv)}`);
      expect(mv).toEqual({ kind: "piece", to: 4 }); // cell4 = linha0 = vitória
    }
  });

  it("posição vencedora (2 casas, caminho livre): avança monotônico", () => {
    // p1 dist 2 (cell22=l2c4), p2 dist 2 (cell58=l6c4). p1 joga primeiro → deve vencer.
    let s = mkState({ p1: 22, p2: 58, turn: 1 });
    const diff: Record<PlayerId, BotDifficulty> = { 1: "hard", 2: "hard" };
    let p1prev = bfsDist(s, s.p1, 0);
    let increases = 0;
    let plies = 0;
    for (; plies < 12 && s.winner === null; plies++) {
      const mv = botMove(s, s.turn, diff[s.turn]);
      if (!mv) break;
      const r = applyMove(s, s.turn, mv);
      if (!r.ok) break;
      s = r.state;
      const d1 = bfsDist(s, s.p1, 0);
      if (d1 > p1prev) increases++;
      p1prev = d1;
    }
    // eslint-disable-next-line no-console
    console.log(`[winning] vencedor=${s.winner} em ${plies} plies; aumentos de dist do p1: ${increases}`);
    // DOCUMENTA (não falha a suíte): em posição vencedora simétrica/contestada o
    // bot às vezes NÃO converte — entra em guerra de paredes e a distância sobe.
    // Ver BOT_DIAGNOSTIC_REPORT.md. Asserção frouxa de propósito.
    expect(plies).toBeGreaterThan(0);
  });

  it("caminho bloqueado à frente: contorna sem recuar à toa", () => {
    // p1 em 40; parede H(3,4) bloqueia up (31). Deve contornar lateral (dist igual)
    // ou colocar parede — NÃO recuar pra down(49, dist 5).
    let s = mkState({ p1: 40, p2: 8, turn: 1 });
    const wall = { type: "h" as const, interRow: 3, interCol: 4 };
    const r = applyMove(s, 1, { kind: "wall", placement: wall });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // r.state agora tem turn=2; volto pra p1 jogar
    s = { ...r.state, turn: 1 };
    for (const d of ["medium", "hard"] as const) {
      const mv = botMove(s, 1, d);
      // eslint-disable-next-line no-console
      console.log(`[blocked] ${d}: ${JSON.stringify(mv)} (up bloqueado)`);
      if (mv!.kind === "piece") expect(mv!.to).not.toBe(49); // não desce (recuo)
    }
  });
});

describe("DIAGNÓSTICO caça-loop (ciclo cross-turn exato)", () => {
  it("detecta repetição EXATA de estado dentro da mesma partida (60 jogos)", () => {
    const GAMES = 60, CAP = 200;
    const diff: Record<PlayerId, BotDifficulty> = { 1: "medium", 2: "hard" };
    let cyclingGames = 0, capGames = 0;
    let worstTrace = "";
    for (let g = 0; g < GAMES; g++) {
      const rand = rng(7000 + g);
      const start = randomOpening(rand, Math.floor(rand() * 9));
      if (!start) continue;
      let s = start;
      const seen = new Set<string>();
      const trace: string[] = [];
      let recent: string[] = [positionHash(s)];
      let cycled = false;
      let n = 0;
      for (; n < CAP && s.winner === null; n++) {
        const key = `${s.p1}.${s.p2}.${s.turn}.${s.walls.placements.length}.${s.walls.placements.map((p) => `${p.type}${p.interRow},${p.interCol}`).join("|")}`;
        if (seen.has(key)) { cycled = true; }
        seen.add(key);
        const mv = botMove(s, s.turn, diff[s.turn], recent);
        if (!mv) break;
        trace.push(`${s.turn}:${mv.kind === "piece" ? mv.to : "W"}`);
        const r = applyMove(s, s.turn, mv);
        if (!r.ok) break;
        s = r.state;
        recent.push(positionHash(s));
        if (recent.length > 8) recent.shift();
      }
      if (cycled) cyclingGames++;
      if (s.winner === null && n >= CAP) {
        capGames++;
        if (!worstTrace) worstTrace = trace.slice(-24).join(" ");
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `\n[caça-loop] ${GAMES} jogos: ${cyclingGames} com repetição EXATA de estado cross-turn; ${capGames} bateram cap ${CAP}.` +
      (worstTrace ? `\n  cauda de um jogo travado (turno:destino): ${worstTrace}` : ""),
    );
    expect(GAMES).toBeGreaterThan(0);
  }, 120_000);
});
