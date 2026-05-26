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
      auth: (cb) => {
        void supabase.auth.getSession().then(({ data }) => {
          cb({
            clientId: getClientId(),
            accessToken: data.session?.access_token ?? null,
          });
        });
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
export const reconnectSocket = () => {
  if (!socket) return;
  if (socket.connected) socket.disconnect();
  socket.connect();
};

export const getServerUrl = () => SERVER_URL;
