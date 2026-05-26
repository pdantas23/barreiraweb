// Premia o vencedor de uma partida casual via RPC atomico no Supabase.
// Fail-safe: nunca propaga erro — se o banco cair, o jogo continua e
// apenas logamos. Troféu nao premiado nao quebra a partida.

import { getSupabase } from "./db.js";

export const awardCasualTrophy = async (
  authUserId: string,
  delta: number = 1,
): Promise<void> => {
  try {
    const { data, error } = await getSupabase().rpc("increment_trofeus_casual", {
      p_user_id: authUserId,
      p_delta: delta,
    });
    if (error) {
      console.error(`[trophies] rpc error pra ${authUserId.slice(0, 8)}…:`, error.message);
      return;
    }
    // data e o novo total (int) ou null se o user_id nao bateu em profiles.
    if (data === null) {
      console.warn(`[trophies] user_id ${authUserId.slice(0, 8)}… nao tem linha em profiles — troféu nao gravado`);
      return;
    }
    console.log(`[trophies] ${authUserId.slice(0, 8)}… ${delta > 0 ? "+" : ""}${delta} → ${data}`);
  } catch (err) {
    console.error("[trophies] falha inesperada:", err);
  }
};
