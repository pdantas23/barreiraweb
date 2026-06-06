// === Log de eventos recentes (Tempo Real, analytics) ===
//
// Ring buffer em memória dos últimos eventos do server (partida iniciada,
// encerrada, jogador conectou). Alimenta a seção "Tempo Real" do dashboard via
// /admin/live. Não tem PII: só tipo, código de sala, modo e timestamp — nada de
// nome/email. Volátil (some no restart) — é só pra visão ao vivo.

export type ServerEventType = "match_started" | "match_finished" | "connect";

export type ServerEvent = {
  type: ServerEventType;
  at: number; // epoch ms
  room?: string; // código da sala (quando aplicável)
  detail?: string; // ex.: "casual_online" / "goal" / plataforma
};

const MAX_EVENTS = 40;
const buffer: ServerEvent[] = [];

export const logEvent = (
  type: ServerEventType,
  opts?: { room?: string; detail?: string; at?: number },
): void => {
  buffer.push({ type, at: opts?.at ?? Date.now(), room: opts?.room, detail: opts?.detail });
  if (buffer.length > MAX_EVENTS) buffer.shift();
};

// Mais recentes primeiro.
export const recentEvents = (limit = MAX_EVENTS): ServerEvent[] =>
  buffer.slice(-limit).reverse();
