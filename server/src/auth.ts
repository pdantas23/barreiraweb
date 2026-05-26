// Resolve o auth user a partir do JWT enviado no handshake do socket.
// O cliente passa accessToken (JWT do Supabase) em socket.handshake.auth;
// aqui validamos com supabase.auth.getUser(token) e devolvemos o user.id.
//
// Cache em memoria por token (TTL curto) pra evitar round-trip ao Supabase
// a cada socket connection — getUser() faz uma chamada HTTP pra Supabase.

import { getSupabase } from "./db.js";

type CacheEntry = { userId: string | null; expiresAt: number };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5min, bem abaixo da expiry do JWT (1h)
const cache = new Map<string, CacheEntry>();

export const resolveAuthUser = async (
  accessToken: string | null | undefined,
): Promise<string | null> => {
  if (!accessToken) return null;

  const now = Date.now();
  const hit = cache.get(accessToken);
  if (hit && hit.expiresAt > now) {
    return hit.userId;
  }

  try {
    const { data, error } = await getSupabase().auth.getUser(accessToken);
    if (error || !data?.user) {
      cache.set(accessToken, { userId: null, expiresAt: now + CACHE_TTL_MS });
      return null;
    }
    cache.set(accessToken, { userId: data.user.id, expiresAt: now + CACHE_TTL_MS });
    return data.user.id;
  } catch (err) {
    console.error("[auth] resolveAuthUser falhou:", err);
    return null;
  }
};
