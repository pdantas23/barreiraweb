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
import type { ServerRoom } from "./lobby.js";

export type FinishReason = "goal" | "timeout_wo" | "leave_wo" | "abandoned";

// Inicia o registro: gera id, grava em `room.matchId` e insere (fire-and-forget).
// Guarda contra dupla chamada (idempotente por sala enquanto a partida roda).
export const recordMatchStart = (room: ServerRoom): void => {
  if (room.matchId) return; // já registrada

  const id = randomUUID();
  room.matchId = id;

  const p1 = room.players.find((p) => p.enginePlayer === 1) ?? null;
  const p2 = room.players.find((p) => p.enginePlayer === 2) ?? null;

  const row = {
    id,
    room_code: room.code,
    mode: room.isPrivate ? "private_online" : "casual_online",
    p1_client_id: p1?.clientId ?? null,
    p1_user_id: p1?.authUserId ?? null,
    p1_is_bot: p1?.isBot ?? false,
    p1_platform: p1?.platform ?? null,
    p2_client_id: p2?.clientId ?? null,
    p2_user_id: p2?.authUserId ?? null,
    p2_is_bot: p2?.isBot ?? false,
    p2_platform: p2?.platform ?? null,
  };

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

  void (async () => {
    try {
      const { error } = await getSupabase()
        .from("matches")
        .update({
          finished_at: new Date().toISOString(),
          winner,
          finish_reason: reason,
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
