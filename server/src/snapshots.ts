// === Snapshots de presença online (analytics — Fase 6) ===
//
// O server tira uma "foto" da presença a cada N segundos e grava em
// `online_snapshots`. O dashboard (web) lê a última linha pra mostrar
// "online agora" e as linhas do dia pra um gráfico histórico.
//
// Isso evita um endpoint HTTP (e mexer no nginx): o server só ESCREVE no
// banco (já tem a service key); o cliente só LÊ (RLS público). A latência de
// "online agora" é de até um intervalo (~60s), aceitável pra um dashboard.

import { getSupabase } from "./db.js";

export type OnlineStats = {
  online_total: number;
  online_in_lobby: number;
  online_in_game: number;
  registered_online: number;
  anonymous_online: number;
};

// Poda snapshots com mais de 30 dias a cada ~60 escritas (≈1x/hora se o
// intervalo é 60s), pra a tabela não crescer sem limite.
const PRUNE_EVERY = 60;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
let writeCount = 0;

export const recordOnlineSnapshot = (stats: OnlineStats): void => {
  void (async () => {
    try {
      const sb = getSupabase();
      const { error } = await sb.from("online_snapshots").insert({
        taken_at: new Date().toISOString(),
        ...stats,
      });
      if (error) {
        console.warn("[snapshots] insert falhou:", error.message);
        return;
      }
      if (++writeCount % PRUNE_EVERY === 0) {
        const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
        await sb.from("online_snapshots").delete().lt("taken_at", cutoff);
      }
    } catch (err) {
      console.warn("[snapshots] erro inesperado:", err);
    }
  })();
};
