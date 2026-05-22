// Singleton de socket.io tipado. UMA conexão por app — todas as telas online
// (lobby, sala, jogo) compartilham essa instância.
//
// `autoConnect: false` deixa a conexão sob nosso controle: a tela /online
// chama connectSocket() ao montar; a tela /game chama disconnect quando
// o usuário sai. Evita conexão fantasma quando o usuário nunca abre o online.

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  GameStartPayload,
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

// Cache global do último gameStart recebido.
// Por que existe: quando o usuário entra como guest, o fluxo é:
//   1. /online chama joinRoom() RPC
//   2. server emite gameStart imediatamente
//   3. server responde o ack
//   4. /online navega pra /online-game após o ack
//   5. /online-game monta e SÓ ENTÃO registra socket.on("gameStart", ...)
// O passo 2 chega antes do passo 5 → evento sem listener, perdido →
// tela trava em "Aguardando oponente...".
// Esse cache armazena no nível do módulo (que persiste entre telas) e a
// /online-game lê no mount como bootstrap.
let lastGameStart: GameStartPayload | null = null;

const wireGlobalListeners = (s: AppSocket) => {
  s.on("gameStart", (payload) => {
    lastGameStart = payload;
  });
};

export const getLastGameStart = (): GameStartPayload | null => lastGameStart;
export const clearLastGameStart = () => {
  lastGameStart = null;
};

export const getSocket = (): AppSocket => {
  if (!socket) {
    const cid = getClientId();
    console.log("[socket] criando com clientId:", cid, "URL:", SERVER_URL);
    socket = io(SERVER_URL, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 800,
      auth: { clientId: cid },
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

export const getServerUrl = () => SERVER_URL;
