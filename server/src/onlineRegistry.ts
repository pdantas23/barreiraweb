// === Registry de presença online ===
//
// Mapeia username (usuário logado) → conjunto de sockets conectados. Um mesmo
// usuário pode ter vários sockets (web + mobile + abas). Usado pelo sistema de
// amizade pra status online/offline e pra rotear pushes (gameInvite etc).
//
// Estado em memória (não persiste). Reconstruído conforme os sockets conectam.

export type OnlineRegistry = {
  /** Registra um socket pra um username. Retorna true se o user FICOU online
   *  agora (era o 1º socket) — útil pra disparar friendStatusChanged. */
  add(username: string, socketId: string): boolean;
  /** Remove um socket. Retorna o username e se o user FICOU offline (0 sockets). */
  remove(socketId: string): { username: string; nowOffline: boolean } | null;
  isOnline(username: string): boolean;
  socketsOf(username: string): string[];
  usernameOf(socketId: string): string | null;
};

export const createOnlineRegistry = (): OnlineRegistry => {
  // username → set de socketIds
  const byUser = new Map<string, Set<string>>();
  // socketId → username (índice reverso pra disconnect O(1))
  const bySocket = new Map<string, string>();

  return {
    add(username, socketId) {
      // Se esse socket já estava mapeado pra outro user, limpa antes.
      const prev = bySocket.get(socketId);
      if (prev && prev !== username) {
        byUser.get(prev)?.delete(socketId);
      }
      let set = byUser.get(username);
      const wasOffline = !set || set.size === 0;
      if (!set) {
        set = new Set();
        byUser.set(username, set);
      }
      set.add(socketId);
      bySocket.set(socketId, username);
      return wasOffline;
    },

    remove(socketId) {
      const username = bySocket.get(socketId);
      if (!username) return null;
      bySocket.delete(socketId);
      const set = byUser.get(username);
      if (!set) return { username, nowOffline: true };
      set.delete(socketId);
      const nowOffline = set.size === 0;
      if (nowOffline) byUser.delete(username);
      return { username, nowOffline };
    },

    isOnline(username) {
      const set = byUser.get(username);
      return !!set && set.size > 0;
    },

    socketsOf(username) {
      return Array.from(byUser.get(username) ?? []);
    },

    usernameOf(socketId) {
      return bySocket.get(socketId) ?? null;
    },
  };
};
