import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  GameStartPayload,
  ServerToClientEvents,
} from "@barreira/shared";
import { getClientId } from "./clientId";
import { supabase } from "./supabase";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
console.log("[socket] SERVER_URL:", SERVER_URL);

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

let lastGameStart: GameStartPayload | null = null;

const wireGlobalListeners = (s: AppSocket) => {
  s.on("gameStart", (payload) => {
    lastGameStart = payload;
  });
  s.on("connect", () => console.log("[socket] conectado, id:", s.id));
  s.on("connect_error", (err) => console.warn("[socket] connect_error:", err.message));
  s.on("disconnect", (reason) => console.warn("[socket] desconectado:", reason));
};

export const getLastGameStart = (): GameStartPayload | null => lastGameStart;
export const clearLastGameStart = () => {
  lastGameStart = null;
};

export const getSocket = (): AppSocket => {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ["polling", "websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 800,
      // Funcao = avaliada a cada tentativa de conexao, entao login/logout
      // ou refresh do JWT sao refletidos sem recriar o socket.
      //
      // Importante: supabase.auth.getSession() pode retornar null no
      // primeiro call antes do _loadSession() interno terminar de ler
      // o localStorage. Pra evitar handshake como anônimo quando o user
      // já está logado, se a sessão vier null e ainda não tivermos
      // tentado refresh, chamamos refreshSession() pra forçar o SDK a
      // carregar/renovar antes de devolver o token.
      auth: (cb) => {
        void (async () => {
          const clientId = getClientId();
          let { data } = await supabase.auth.getSession();
          if (!data.session) {
            // Tenta forçar o SDK a carregar a sessão do storage / dar
            // refresh. Ignora erro silenciosamente — se não tem sessão
            // mesmo, segue como anônimo.
            try {
              const refreshed = await supabase.auth.refreshSession();
              if (refreshed.data.session) data = { session: refreshed.data.session };
            } catch {
              // sem sessão: usuário não logado, cb com accessToken=null
            }
          }
          const accessToken = data.session?.access_token ?? null;
          console.log(
            `[socket-auth] clientId=${clientId} accessToken=${accessToken ? "present" : "null"}`,
          );
          cb({ clientId, accessToken });
        })();
      },
    });
    wireGlobalListeners(socket);
  }
  return socket;
};

export const connectSocket = (): AppSocket => {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};

// Forca o socket a desconectar+reconectar pra refletir mudanca de auth state.
// Chamado pelo AuthProvider quando o usuario loga/desloga.
//
// Sempre dá disconnect antes — se o socket estiver em estado "connecting"
// (mid-handshake) com auth stale, só chamar connect() é no-op e o
// handshake antigo termina com auth desatualizado.
export const reconnectSocket = () => {
  if (!socket) return;
  socket.disconnect();
  socket.connect();
};

export const getServerUrl = () => SERVER_URL;
