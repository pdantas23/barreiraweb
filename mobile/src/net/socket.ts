// Singleton de socket.io tipado. UMA conexão por app — todas as telas online
// (lobby, sala, jogo) compartilham essa instância.
//
// `autoConnect: false` deixa a conexão sob nosso controle: a tela /online
// chama connectSocket() ao montar; a tela /game chama disconnect quando
// o usuário sai. Evita conexão fantasma quando o usuário nunca abre o online.

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@barreira/shared";
import { getClientId } from "./clientId";

// EXPO_PUBLIC_* é exposto pelo Expo em runtime via process.env.
// Fallback pra localhost só pra não quebrar em dev se o .env sumir.
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://localhost:3000";

// Convenção do socket.io-client: ServerToClient vai primeiro (eventos
// que o cliente RECEBE), ClientToServer vai depois (eventos que EMITE).
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export const getSocket = (): AppSocket => {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ["websocket"],
      autoConnect: false,
      // Reconexão automática — server reanexa a sala via clientId.
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 800,
      // clientId vai no handshake auth → server lê via socket.handshake.auth.
      // Permite que o server identifique esse cliente mesmo após o socket.id
      // mudar (Wi-Fi caiu, app voltou de background, etc).
      auth: { clientId: getClientId() },
    });
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

export const getServerUrl = () => SERVER_URL;
