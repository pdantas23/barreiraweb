// === Sistema de amizade (lógica de negócio) ===
//
// Handlers de amizade e convite de partida, desacoplados do Socket.IO e do
// Supabase via dependências injetadas (FriendStore + OnlineRegistry + emit).
// Assim os testes exercitam a regra com um store em memória, sem banco.
//
// Erros viram LobbyError(<RpcError>) — o wrapper rpc() do index.ts converte
// pro ack tipado, igual ao resto do projeto.

import { LobbyError } from "./lobby.js";
import { getSupabase } from "./db.js";
import type { OnlineRegistry } from "./onlineRegistry.js";
import type {
  Friend,
  FriendsData,
  FriendStatus,
  InviteAcceptResult,
} from "@barreira/shared";

export type FriendshipStatus = "pending" | "accepted" | "declined";

export type FriendPair = {
  requester: string;
  receiver: string;
  status: FriendshipStatus;
};

// Camada de dados — abstrai o Supabase. Tudo que o serviço precisa do banco.
export type FriendStore = {
  usernameExists(username: string): Promise<boolean>;
  /** Registro entre o par em qualquer direção (a→b ou b→a). */
  getPair(a: string, b: string): Promise<FriendPair | null>;
  /** Registro na direção exata requester→receiver. */
  getDirected(requester: string, receiver: string): Promise<FriendPair | null>;
  /** Cria pedido pendente requester→receiver (limpando qualquer par anterior). */
  upsertRequest(requester: string, receiver: string): Promise<void>;
  setStatus(requester: string, receiver: string, status: FriendshipStatus): Promise<void>;
  /** Remove a amizade nos dois sentidos. */
  deletePair(a: string, b: string): Promise<void>;
  listAccepted(username: string): Promise<string[]>;
  listIncoming(username: string): Promise<string[]>;
  listOutgoing(username: string): Promise<string[]>;
  /** Troféus casual de cada username (0 quando ausente). */
  getTrophies(usernames: string[]): Promise<Record<string, number>>;
  getCooldown(from: string, to: string): Promise<{ count: number; windowStart: number } | null>;
  setCooldown(from: string, to: string, count: number, windowStart: number): Promise<void>;
  clearCooldown(from: string, to: string): Promise<void>;
  recordInvite(from: string, to: string, code: string | null, expiresAt: number): Promise<void>;
};

export const INVITE_TTL_MS = 30_000; // convite expira em 30s
export const COOLDOWN_WINDOW_MS = 5 * 60_000; // janela anti-spam: 5 min
export const COOLDOWN_MAX = 2; // máx convites não aceitos por par na janela

type EmitFn = (username: string, event: string, payload: unknown) => void;

export type FriendDeps = {
  store: FriendStore;
  registry: Pick<OnlineRegistry, "isOnline" | "socketsOf">;
  // Emite um evento server→client pra todos os sockets de um username online.
  emitToUser: EmitFn;
  isInGame: (username: string) => boolean;
  // Cria a sala privada quando um convite é aceito. Null = não deu (ex: o
  // convidante caiu). Em produção usa o lobby; em teste é um fake.
  createInviteRoom: (fromUsername: string, toUsername: string) => InviteAcceptResult | null;
  // Push best-effort quando o alvo está offline (Parte 4). Opcional.
  sendInvitePush?: (toUsername: string, fromUsername: string) => void;
  now?: () => number;
};

type PendingInvite = { expiresAt: number; timer: ReturnType<typeof setTimeout> | null };

export type FriendService = ReturnType<typeof createFriendService>;

const norm = (u: string): string => u.trim();

export const createFriendService = (deps: FriendDeps) => {
  const { store, registry, emitToUser, isInGame, createInviteRoom } = deps;
  const now = deps.now ?? (() => Date.now());

  // Convites em andamento, em memória: chave `from->to`.
  const pending = new Map<string, PendingInvite>();
  const key = (from: string, to: string) => `${from}->${to}`;

  const statusOf = (username: string): FriendStatus => {
    if (!registry.isOnline(username)) return "offline";
    return isInGame(username) ? "in-game" : "online";
  };

  const clearPending = (from: string, to: string) => {
    const k = key(from, to);
    const inv = pending.get(k);
    if (inv?.timer) clearTimeout(inv.timer);
    pending.delete(k);
  };

  // ---- Amizade ----

  const sendFriendRequest = async (me: string, targetRaw: string): Promise<null> => {
    const target = norm(targetRaw);
    if (!target) throw new LobbyError("invalid-payload");
    if (target === me) throw new LobbyError("self-friend", "Você não pode se adicionar.");
    if (!(await store.usernameExists(target))) {
      throw new LobbyError("friend-not-found", "Usuário não encontrado.");
    }
    const existing = await store.getPair(me, target);
    if (existing?.status === "accepted") {
      throw new LobbyError("already-friends", "Vocês já são amigos.");
    }
    if (existing?.status === "pending") {
      throw new LobbyError("request-pending", "Já existe um pedido pendente.");
    }
    // declined (ou inexistente) → (re)cria pedido na direção me→target.
    await store.upsertRequest(me, target);
    if (registry.isOnline(target)) {
      emitToUser(target, "friendRequestReceived", { fromUsername: me });
    }
    return null;
  };

  const acceptFriendRequest = async (me: string, requesterRaw: string): Promise<null> => {
    const requester = norm(requesterRaw);
    const row = await store.getDirected(requester, me);
    if (!row || row.status !== "pending") {
      throw new LobbyError("no-friend-request", "Nenhum pedido pendente desse usuário.");
    }
    await store.setStatus(requester, me, "accepted");
    // Avisa quem pediu que virou amizade (atualiza a lista dele em tempo real).
    if (registry.isOnline(requester)) {
      emitToUser(requester, "friendStatusChanged", { username: me, status: statusOf(me) });
    }
    return null;
  };

  const declineFriendRequest = async (me: string, requesterRaw: string): Promise<null> => {
    const requester = norm(requesterRaw);
    const row = await store.getDirected(requester, me);
    if (!row || row.status !== "pending") {
      throw new LobbyError("no-friend-request", "Nenhum pedido pendente desse usuário.");
    }
    await store.setStatus(requester, me, "declined");
    return null;
  };

  const removeFriend = async (me: string, targetRaw: string): Promise<null> => {
    const target = norm(targetRaw);
    await store.deletePair(me, target);
    // Atualiza a lista do outro lado em tempo real, se online.
    if (registry.isOnline(target)) {
      emitToUser(target, "friendStatusChanged", { username: me, status: "offline" });
    }
    return null;
  };

  const getFriends = async (me: string): Promise<FriendsData> => {
    const [accepted, incoming, outgoing] = await Promise.all([
      store.listAccepted(me),
      store.listIncoming(me),
      store.listOutgoing(me),
    ]);
    const trophies = await store.getTrophies(accepted);
    const friends: Friend[] = accepted.map((username) => ({
      username,
      status: statusOf(username),
      trofeus: trophies[username] ?? 0,
    }));
    return { friends, incomingRequests: incoming, outgoingRequests: outgoing };
  };

  // ---- Convite de partida ----

  const sendGameInvite = async (me: string, targetRaw: string): Promise<null> => {
    const target = norm(targetRaw);
    if (target === me) throw new LobbyError("self-friend");
    const pair = await store.getPair(me, target);
    if (pair?.status !== "accepted") {
      throw new LobbyError("not-friends", "Vocês precisam ser amigos primeiro.");
    }
    // Offline: best-effort push e erro claro pro convidante.
    if (!registry.isOnline(target)) {
      deps.sendInvitePush?.(target, me);
      throw new LobbyError("friend-offline", `${target} está offline agora.`);
    }
    if (isInGame(target)) {
      throw new LobbyError("friend-in-game", `${target} está em partida.`);
    }
    // Anti-spam: máx 2 convites não aceitos por par numa janela de 5 min.
    const t = now();
    const cd = await store.getCooldown(me, target);
    const withinWindow = cd && t - cd.windowStart < COOLDOWN_WINDOW_MS;
    const currentCount = withinWindow ? cd!.count : 0;
    if (currentCount >= COOLDOWN_MAX) {
      throw new LobbyError(
        "invite-cooldown",
        `Você já convidou ${target} demais. Espere um pouco.`,
      );
    }
    await store.setCooldown(me, target, currentCount + 1, withinWindow ? cd!.windowStart : t);

    // Registra o convite (memória + persistência best-effort) e agenda expiração.
    const expiresAt = t + INVITE_TTL_MS;
    clearPending(me, target);
    const timer = setTimeout(() => {
      pending.delete(key(me, target));
      if (registry.isOnline(target)) emitToUser(target, "gameInviteExpired", { fromUsername: me });
      if (registry.isOnline(me)) emitToUser(me, "gameInviteExpired", { fromUsername: me });
    }, INVITE_TTL_MS);
    // Não segura o process vivo só por causa do timer.
    (timer as unknown as { unref?: () => void }).unref?.();
    pending.set(key(me, target), { expiresAt, timer });
    void store.recordInvite(me, target, null, expiresAt);

    emitToUser(target, "gameInviteReceived", { fromUsername: me, expiresAt });
    return null;
  };

  const respondGameInvite = async (
    me: string,
    fromRaw: string,
    accept: boolean,
  ): Promise<InviteAcceptResult | null> => {
    const from = norm(fromRaw);
    const inv = pending.get(key(from, me));
    if (!inv || inv.expiresAt <= now()) {
      clearPending(from, me);
      throw new LobbyError("no-invite-pending", "Esse convite expirou.");
    }
    clearPending(from, me);

    if (!accept) {
      // Notifica quem convidou que foi recusado.
      if (registry.isOnline(from)) {
        emitToUser(from, "gameInviteResponse", { fromUsername: me, accept: false });
      }
      return null;
    }

    // Aceitou: convite consumido → zera o cooldown do par.
    await store.clearCooldown(from, me);
    const room = createInviteRoom(from, me);
    if (!room) {
      throw new LobbyError("internal-error", "Não foi possível criar a sala.");
    }
    // Notifica o convidante com o código (ele entra como host).
    if (registry.isOnline(from)) {
      emitToUser(from, "gameInviteResponse", {
        fromUsername: me,
        accept: true,
        code: room.code,
        password: room.password,
      });
    }
    // Devolve pro convidado entrar na sala.
    return room;
  };

  // ---- Presença ----

  // Avisa os amigos (aceitos) que estão online sobre uma mudança de status.
  const notifyFriendsOfStatus = async (me: string, status: FriendStatus): Promise<void> => {
    const friends = await store.listAccepted(me);
    for (const f of friends) {
      if (registry.isOnline(f)) {
        emitToUser(f, "friendStatusChanged", { username: me, status });
      }
    }
  };

  return {
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    getFriends,
    sendGameInvite,
    respondGameInvite,
    notifyFriendsOfStatus,
    statusOf,
    // exposto pra testes/depuração
    _pending: pending,
  };
};

// ============================================================================
// Store em memória — usado nos testes (e como referência da semântica).
// ============================================================================

export const createInMemoryFriendStore = (
  knownUsernames: string[] = [],
  trophies: Record<string, number> = {},
): FriendStore & { _pairs: FriendPair[] } => {
  const usernames = new Set(knownUsernames);
  let pairs: FriendPair[] = [];
  const cooldowns = new Map<string, { count: number; windowStart: number }>();
  const invites: { from: string; to: string; code: string | null; expiresAt: number }[] = [];
  const ck = (a: string, b: string) => `${a}->${b}`;

  const findPair = (a: string, b: string) =>
    pairs.find(
      (p) =>
        (p.requester === a && p.receiver === b) ||
        (p.requester === b && p.receiver === a),
    ) ?? null;

  return {
    _pairs: pairs,
    async usernameExists(u) {
      return usernames.has(u);
    },
    async getPair(a, b) {
      const p = findPair(a, b);
      return p ? { ...p } : null;
    },
    async getDirected(requester, receiver) {
      const p = pairs.find((x) => x.requester === requester && x.receiver === receiver);
      return p ? { ...p } : null;
    },
    async upsertRequest(requester, receiver) {
      pairs = pairs.filter(
        (p) =>
          !(
            (p.requester === requester && p.receiver === receiver) ||
            (p.requester === receiver && p.receiver === requester)
          ),
      );
      pairs.push({ requester, receiver, status: "pending" });
    },
    async setStatus(requester, receiver, status) {
      const p = pairs.find((x) => x.requester === requester && x.receiver === receiver);
      if (p) p.status = status;
    },
    async deletePair(a, b) {
      pairs = pairs.filter((p) => !((p.requester === a && p.receiver === b) || (p.requester === b && p.receiver === a)));
    },
    async listAccepted(username) {
      return pairs
        .filter((p) => p.status === "accepted" && (p.requester === username || p.receiver === username))
        .map((p) => (p.requester === username ? p.receiver : p.requester));
    },
    async listIncoming(username) {
      return pairs.filter((p) => p.status === "pending" && p.receiver === username).map((p) => p.requester);
    },
    async listOutgoing(username) {
      return pairs.filter((p) => p.status === "pending" && p.requester === username).map((p) => p.receiver);
    },
    async getTrophies(usernames) {
      const out: Record<string, number> = {};
      for (const u of usernames) out[u] = trophies[u] ?? 0;
      return out;
    },
    async getCooldown(from, to) {
      const c = cooldowns.get(ck(from, to));
      return c ? { ...c } : null;
    },
    async setCooldown(from, to, count, windowStart) {
      cooldowns.set(ck(from, to), { count, windowStart });
    },
    async clearCooldown(from, to) {
      cooldowns.delete(ck(from, to));
    },
    async recordInvite(from, to, code, expiresAt) {
      invites.push({ from, to, code, expiresAt });
    },
  };
};

// ============================================================================
// Store Supabase — implementação de produção.
// ============================================================================

export const createSupabaseFriendStore = (): FriendStore => {
  const sb = () => getSupabase();

  return {
    async usernameExists(username) {
      const { data } = await sb()
        .from("profiles")
        .select("username")
        .eq("username", username)
        .maybeSingle();
      return !!data;
    },
    async getPair(a, b) {
      const { data } = await sb()
        .from("friendships")
        .select("requester_username, receiver_username, status")
        .or(
          `and(requester_username.eq.${a},receiver_username.eq.${b}),and(requester_username.eq.${b},receiver_username.eq.${a})`,
        )
        .maybeSingle();
      if (!data) return null;
      return {
        requester: data.requester_username,
        receiver: data.receiver_username,
        status: data.status,
      };
    },
    async getDirected(requester, receiver) {
      const { data } = await sb()
        .from("friendships")
        .select("requester_username, receiver_username, status")
        .eq("requester_username", requester)
        .eq("receiver_username", receiver)
        .maybeSingle();
      if (!data) return null;
      return { requester: data.requester_username, receiver: data.receiver_username, status: data.status };
    },
    async upsertRequest(requester, receiver) {
      // Limpa qualquer par anterior (nos dois sentidos) e cria o pedido novo.
      await this.deletePair(requester, receiver);
      const { error } = await sb()
        .from("friendships")
        .insert({ requester_username: requester, receiver_username: receiver, status: "pending" });
      if (error) throw new Error(`friendships insert: ${error.message}`);
    },
    async setStatus(requester, receiver, status) {
      const { error } = await sb()
        .from("friendships")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("requester_username", requester)
        .eq("receiver_username", receiver);
      if (error) throw new Error(`friendships update: ${error.message}`);
    },
    async deletePair(a, b) {
      await sb()
        .from("friendships")
        .delete()
        .or(
          `and(requester_username.eq.${a},receiver_username.eq.${b}),and(requester_username.eq.${b},receiver_username.eq.${a})`,
        );
    },
    async listAccepted(username) {
      const { data } = await sb()
        .from("friendships")
        .select("requester_username, receiver_username")
        .eq("status", "accepted")
        .or(`requester_username.eq.${username},receiver_username.eq.${username}`);
      return (data ?? []).map((r) =>
        r.requester_username === username ? r.receiver_username : r.requester_username,
      );
    },
    async listIncoming(username) {
      const { data } = await sb()
        .from("friendships")
        .select("requester_username")
        .eq("status", "pending")
        .eq("receiver_username", username);
      return (data ?? []).map((r) => r.requester_username);
    },
    async listOutgoing(username) {
      const { data } = await sb()
        .from("friendships")
        .select("receiver_username")
        .eq("status", "pending")
        .eq("requester_username", username);
      return (data ?? []).map((r) => r.receiver_username);
    },
    async getTrophies(usernames) {
      if (usernames.length === 0) return {};
      const { data } = await sb()
        .from("profiles")
        .select("username, trofeus_casual")
        .in("username", usernames);
      const out: Record<string, number> = {};
      for (const r of data ?? []) out[r.username] = r.trofeus_casual ?? 0;
      return out;
    },
    async getCooldown(from, to) {
      const { data } = await sb()
        .from("invite_cooldowns")
        .select("invite_count, window_start")
        .eq("from_username", from)
        .eq("to_username", to)
        .maybeSingle();
      if (!data) return null;
      return { count: data.invite_count, windowStart: new Date(data.window_start).getTime() };
    },
    async setCooldown(from, to, count, windowStart) {
      await sb()
        .from("invite_cooldowns")
        .upsert(
          {
            from_username: from,
            to_username: to,
            invite_count: count,
            window_start: new Date(windowStart).toISOString(),
          },
          { onConflict: "from_username,to_username" },
        );
    },
    async clearCooldown(from, to) {
      await sb().from("invite_cooldowns").delete().eq("from_username", from).eq("to_username", to);
    },
    async recordInvite(from, to, code, expiresAt) {
      await sb().from("friend_invites").insert({
        from_username: from,
        to_username: to,
        room_code: code,
        expires_at: new Date(expiresAt).toISOString(),
      });
    },
  };
};
