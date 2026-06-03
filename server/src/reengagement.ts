// === Reengajamento por push ===
//
// Todo dia às 18h (horário de Brasília = 21:00 UTC), envia um push pra quem
// não joga há 48h+ e tem push token cadastrado — sem reenviar pra quem já
// recebeu push nas últimas 24h (push_tokens.last_push_at).

import { getSupabase } from "./db.js";
import { sendExpoPush } from "./push.js";

const H = 3_600_000;
const REENGAGE_HOUR_UTC = 21; // 18h BRT
const INACTIVE_MS = 48 * H;
const PUSH_DEDUP_MS = 24 * H;

// ms até o próximo horário-alvo (hora UTC). Pura — testável sem relógio real.
export const msUntilNextRun = (nowMs: number, targetUtcHour: number): number => {
  const now = new Date(nowMs);
  const next = new Date(nowMs);
  next.setUTCHours(targetUtcHour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - nowMs;
};

// Executa uma rodada de reengajamento. Best-effort; loga e segue em erro.
export const runReengagement = async (nowMs = Date.now()): Promise<number> => {
  const sb = getSupabase();
  const inactiveCutoff = new Date(nowMs - INACTIVE_MS).toISOString();
  const pushCutoff = new Date(nowMs - PUSH_DEDUP_MS).toISOString();

  // 1) Usuários inativos há 48h+ (ou que nunca jogaram).
  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("user_id, last_played_at");
  if (pErr) {
    console.warn("[reengage] erro lendo profiles:", pErr.message);
    return 0;
  }
  const inactiveIds = (profiles ?? [])
    .filter((p) => !p.last_played_at || p.last_played_at < inactiveCutoff)
    .map((p) => p.user_id as string);
  if (inactiveIds.length === 0) return 0;

  // 2) Tokens desses users que NÃO receberam push nas últimas 24h.
  const { data: tokens, error: tErr } = await sb
    .from("push_tokens")
    .select("token, user_id, last_push_at")
    .in("user_id", inactiveIds);
  if (tErr) {
    console.warn("[reengage] erro lendo push_tokens:", tErr.message);
    return 0;
  }
  const targets = (tokens ?? []).filter(
    (t) => !t.last_push_at || t.last_push_at < pushCutoff,
  );
  if (targets.length === 0) return 0;

  // 3) Envia e marca last_push_at.
  await sendExpoPush(
    targets.map((t) => ({
      to: t.token as string,
      title: "Barreira",
      body: "Seus amigos estão jogando Barreira! Venha jogar 🎯",
      sound: "default" as const,
      data: { type: "reengagement" },
    })),
  );
  const nowIso = new Date(nowMs).toISOString();
  await sb
    .from("push_tokens")
    .update({ last_push_at: nowIso })
    .in(
      "token",
      targets.map((t) => t.token as string),
    );

  console.log(`[reengage] push enviado pra ${targets.length} device(s)`);
  return targets.length;
};

// Agenda a 1ª rodada pro próximo 18h BRT e depois a cada 24h.
export const startReengagementCron = (): void => {
  const schedule = () => {
    const delay = msUntilNextRun(Date.now(), REENGAGE_HOUR_UTC);
    console.log(`[reengage] próxima rodada em ${Math.round(delay / 60000)}min`);
    const t = setTimeout(() => {
      void runReengagement().catch((e) => console.warn("[reengage] falhou:", e));
      setInterval(() => {
        void runReengagement().catch((e) => console.warn("[reengage] falhou:", e));
      }, 24 * H);
    }, delay);
    (t as unknown as { unref?: () => void }).unref?.();
  };
  schedule();
};
