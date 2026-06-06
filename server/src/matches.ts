// === Registro de partidas (analytics — Fase 3) ===
//
// Insere uma linha em `matches` quando uma partida começa e a finaliza no fim.
// Tudo é fire-and-forget: NUNCA bloqueia o fluxo de jogo (se o Supabase estiver
// fora do ar, a partida segue normal e só perdemos a métrica).
//
// O UUID é gerado AQUI (não no banco) pra o `matchId` ficar disponível na hora,
// sem esperar o INSERT — assim o finalize consegue referenciar a linha mesmo
// que o INSERT ainda esteja em voo.
//
// Modo: salas reais do server são `casual_online` ou `private_online`. O modo
// `training_offline` é reportado por outro caminho (endpoint HTTP, Fase 5).

import { randomUUID } from "node:crypto";
import type { PlayerId } from "@barreira/shared";
import { getSupabase } from "./db.js";
import { logEvent } from "./eventLog.js";
import type { ServerRoom } from "./lobby.js";

export type FinishReason = "goal" | "timeout_wo" | "leave_wo" | "abandoned";

// Inicia o registro: gera id, grava em `room.matchId` e insere (fire-and-forget).
// Guarda contra dupla chamada (idempotente por sala enquanto a partida roda).
export const recordMatchStart = (room: ServerRoom): void => {
  if (room.matchId) return; // já registrada

  const id = randomUUID();
  room.matchId = id;
  room.moveCount = 0; // zera o contador de lances pra esta partida (cobre revanche)

  const p1 = room.players.find((p) => p.enginePlayer === 1) ?? null;
  const p2 = room.players.find((p) => p.enginePlayer === 2) ?? null;

  // mode é derivado do source (não de isPrivate): matchmaking é casual mesmo
  // nascendo "privado" pra não aparecer no lobby. Convite e sala privada manual
  // são private_online.
  const mode =
    room.isPrivate && room.source !== "matchmaking" ? "private_online" : "casual_online";

  // Dificuldade do bot (qualquer lado que seja bot); null se humano vs humano.
  const botDifficulty =
    (p1?.isBot ? p1.botDifficulty : p2?.isBot ? p2.botDifficulty : null) ?? null;

  const row = {
    id,
    room_code: room.code,
    mode,
    source: room.source,
    bot_difficulty: botDifficulty,
    wait_ms: room.waitMs ?? null,
    p1_client_id: p1?.clientId ?? null,
    p1_user_id: p1?.authUserId ?? null,
    p1_is_bot: p1?.isBot ?? false,
    p1_platform: p1?.platform ?? null,
    p1_name: p1?.name ?? null,
    p2_client_id: p2?.clientId ?? null,
    p2_user_id: p2?.authUserId ?? null,
    p2_is_bot: p2?.isBot ?? false,
    p2_platform: p2?.platform ?? null,
    p2_name: p2?.name ?? null,
  };

  logEvent("match_started", { room: room.code, detail: mode });

  void (async () => {
    try {
      const { error } = await getSupabase().from("matches").insert(row);
      if (error) {
        console.warn(`[matches] insert falhou (${room.code}):`, error.message);
      }
    } catch (err) {
      console.warn("[matches] erro inesperado no insert:", err);
    }
  })();
};

// Finaliza: UPDATE por id com winner + reason. Limpa `room.matchId` pra evitar
// finalizar 2x (ex.: timer de W.O. dispara depois de uma vitória normal). Se a
// sala não tem matchId (partida começou antes do deploy, ou já finalizada),
// não faz nada.
export const recordMatchFinish = (
  room: ServerRoom,
  winner: PlayerId | null,
  reason: FinishReason,
): void => {
  const id = room.matchId;
  if (!id) return;
  room.matchId = null;

  logEvent("match_finished", { room: room.code, detail: reason });

  void (async () => {
    try {
      const { error } = await getSupabase()
        .from("matches")
        .update({
          finished_at: new Date().toISOString(),
          winner,
          finish_reason: reason,
          total_moves: room.moveCount,
        })
        .eq("id", id);
      if (error) {
        console.warn(`[matches] finalize falhou (${room.code}):`, error.message);
      }
    } catch (err) {
      console.warn("[matches] erro inesperado no finalize:", err);
    }
  })();
};

// Reconciliação no boot: partidas que ficaram com finished_at NULL são órfãs
// (o server reiniciou no meio do jogo — as salas vivem só em memória e somem no
// restart). Marca como abandonadas pra não distorcer "em andamento" vs total.
// Idempotente; roda uma vez no startup. Fire-and-forget.
export const reconcileOrphanMatches = (): void => {
  void (async () => {
    try {
      const { data, error } = await getSupabase()
        .from("matches")
        .update({ finished_at: new Date().toISOString(), finish_reason: "abandoned" })
        .is("finished_at", null)
        .select("id");
      if (error) {
        console.warn("[matches] reconcile órfãs falhou:", error.message);
        return;
      }
      if (data && data.length > 0) {
        console.log(`[matches] reconcile: ${data.length} partida(s) órfã(s) marcada(s) como abandonada(s)`);
      }
    } catch (err) {
      console.warn("[matches] erro inesperado no reconcile:", err);
    }
  })();
};
