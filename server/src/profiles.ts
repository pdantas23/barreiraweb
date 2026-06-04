// === Identidade persistente anônima ===
//
// Cada clientId vindo do mobile (AsyncStorage) é mapeado num display_name
// único do tipo "anonimo276". O nome persiste — toda vez que o mesmo
// clientId conecta, ele recebe o mesmo nome.

import { getSupabase } from "./db.js";
import { createLruCache } from "./lruCache.js";

const NAME_PREFIX = "anonimo";

// Teto de entradas dos caches em memória — sem isso cresceriam sem limite
// (um por clientId / authUserId). LRU descarta os mais antigos.
const MAX_CACHE_ENTRIES = 5000;

// Cache em memória pra evitar hit no DB a cada handshake/reanchor.
// clientId → displayName. Não tem invalidação — display_name é imutável
// (não temos rename hoje). Se adicionar rename no futuro, invalidar via signal.
const profileCache = createLruCache<string>(MAX_CACHE_ENTRIES);

export type Profile = {
  clientId: string;
  displayName: string;
};

// Sorteia número de N dígitos. Range cresce com tentativas pra cobrir
// o caso (extremo) de colisão repetida quando o banco está cheio.
const randomSuffix = (digits: number): string => {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
};

const generateCandidate = (attempt: number): string => {
  // 0-9: 4 dígitos (anonimo1000-9999) = 9000 combinações
  // 10-19: 5 dígitos (anonimo10000-99999) = 90000 combinações
  // 20+: 6 dígitos (anonimo100000-999999) = 900000 combinações
  const digits = attempt < 10 ? 4 : attempt < 20 ? 5 : 6;
  return `${NAME_PREFIX}${randomSuffix(digits)}`;
};

// Busca existing OR cria novo. Mapeamento client_id → display_name é fixo.
// Se 2 sockets chegam quase simultaneamente com mesmo clientId desconhecido
// (reconnect rápido, race rara), só 1 cria; o outro pega via SELECT.
export const getOrCreateProfile = async (
  clientId: string,
): Promise<Profile> => {
  // Cache hit
  const cached = profileCache.get(clientId);
  if (cached) {
    // Atualiza last_seen_at em background (não bloqueia o handshake)
    void touchLastSeen(clientId);
    return { clientId, displayName: cached };
  }

  const supabase = getSupabase();

  // 1. Tenta buscar profile existente
  const { data: existing, error: selectError } = await supabase
    .from("players")
    .select("display_name")
    .eq("client_id", clientId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`supabase select error: ${selectError.message}`);
  }

  if (existing) {
    profileCache.set(clientId, existing.display_name);
    void touchLastSeen(clientId);
    return { clientId, displayName: existing.display_name };
  }

  // 2. Não existe — gera nome único e insere. Loop com retry porque o
  //    display_name é UNIQUE; pode colidir com outro cliente acabando
  //    de receber o mesmo random.
  const MAX_ATTEMPTS = 30;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateCandidate(attempt);

    const { data, error } = await supabase
      .from("players")
      .insert({
        client_id: clientId,
        display_name: candidate,
      })
      .select("display_name")
      .single();

    if (!error && data) {
      profileCache.set(clientId, candidate);
      return { clientId, displayName: candidate };
    }

    // 23505 = unique_violation. Pode ser:
    // (a) display_name colidiu — retry com novo random
    // (b) client_id colidiu — outro socket criou o mesmo profile em paralelo;
    //     re-busca pra pegar o que ficou
    if (error?.code !== "23505") {
      throw new Error(`supabase insert error: ${error?.message ?? "unknown"}`);
    }

    // Se foi colisão de client_id, parar e re-buscar
    if (error.message?.includes("client_id") || error.details?.includes("client_id")) {
      const { data: again } = await supabase
        .from("players")
        .select("display_name")
        .eq("client_id", clientId)
        .single();
      if (again) {
        profileCache.set(clientId, again.display_name);
        return { clientId, displayName: again.display_name };
      }
    }
    // Senão é colisão de display_name → continua o loop
  }

  throw new Error(
    `Não consegui gerar display_name único após ${MAX_ATTEMPTS} tentativas`,
  );
};

// === Username dos users autenticados (tabela `profiles`, distinto de `players`) ===
//
// Quando o socket tem accessToken válido, `resolveAuthUser` devolve o user_id
// do Supabase Auth. Aqui resolvemos o `username` escolhido no cadastro, pra
// usar como displayName na sala (em vez do "anonimoXXXX" da tabela players).
//
// Cache em memória idêntica à do display_name. Usernames mudam raramente
// (não temos rename na UI hoje), então invalidação não é prioridade.

const usernameCache = createLruCache<string | null>(MAX_CACHE_ENTRIES); // authUserId → username (null = sem profile)

export const getUsernameForAuthUser = async (
  authUserId: string,
): Promise<string | null> => {
  const cached = usernameCache.get(authUserId);
  if (cached !== undefined) return cached;

  const { data, error } = await getSupabase()
    .from("profiles")
    .select("username")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (error) {
    console.warn(
      `[profiles] erro buscando username de ${authUserId.slice(0, 8)}…:`,
      error.message,
    );
    return null;
  }

  const username = (data?.username as string | undefined) ?? null;
  usernameCache.set(authUserId, username);
  return username;
};

// Linka um aparelho anônimo (client_id) à conta Supabase (user_id) quando o
// socket conecta autenticado. É o que separa "anônimo" de "cadastrado" nas
// métricas: user_id NULL = nunca logou nesse aparelho. Latest-login-wins:
// se outra conta logar no mesmo aparelho, o vínculo passa pra ela.
//
// Cache pra não escrever no DB a cada handshake. Fire-and-forget — não derruba
// a sessão se falhar (é só métrica).
const linkedCache = createLruCache<string>(MAX_CACHE_ENTRIES); // clientId → userId

export const linkPlayerToUser = async (
  clientId: string,
  userId: string,
): Promise<void> => {
  if (linkedCache.get(clientId) === userId) return; // já linkado nesta sessão
  try {
    const { error } = await getSupabase()
      .from("players")
      .update({ user_id: userId })
      .eq("client_id", clientId);
    if (error) {
      console.warn(
        `[profiles] falha ao linkar ${clientId.slice(0, 8)}… → user:`,
        error.message,
      );
      return;
    }
    linkedCache.set(clientId, userId);
  } catch (err) {
    console.warn("[profiles] erro inesperado ao linkar player→user:", err);
  }
};

// Atualiza players.last_platform (analytics — Fase 4) quando o cliente informa
// de onde está jogando no handshake. Cache pra não escrever a cada conexão;
// só faz UPDATE quando muda (mesmo aparelho pode trocar de plataforma, raro).
const platformCache = createLruCache<string>(MAX_CACHE_ENTRIES); // clientId → platform

export const updatePlayerPlatform = async (
  clientId: string,
  platform: "web" | "ios" | "android",
): Promise<void> => {
  if (platformCache.get(clientId) === platform) return;
  try {
    const { error } = await getSupabase()
      .from("players")
      .update({ last_platform: platform })
      .eq("client_id", clientId);
    if (error) {
      console.warn(
        `[profiles] falha ao gravar last_platform de ${clientId.slice(0, 8)}…:`,
        error.message,
      );
      return;
    }
    platformCache.set(clientId, platform);
  } catch (err) {
    console.warn("[profiles] erro inesperado ao gravar last_platform:", err);
  }
};

// Atualiza last_seen_at de forma fire-and-forget.
const touchLastSeen = async (clientId: string): Promise<void> => {
  try {
    await getSupabase()
      .from("players")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("client_id", clientId);
  } catch (err) {
    // Não derruba a sessão se o update falhar — last_seen é só métrica
    console.warn("[profiles] failed to touch last_seen:", err);
  }
};
