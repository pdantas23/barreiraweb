// Singleton de socket.io tipado. UMA conexão por app — todas as telas online
// (lobby, sala, jogo) compartilham essa instância.
//
// `autoConnect: false` deixa a conexão sob nosso controle: a tela /online
// chama connectSocket() ao montar; a tela /game chama disconnect quando
// o usuário sai. Evita conexão fantasma quando o usuário nunca abre o online.

import { io, type Socket } from "socket.io-client";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type {
  ClientToServerEvents,
  GameStartPayload,
  ServerToClientEvents,
} from "@barreira/shared";
import { getClientId } from "./clientId";
import { supabase } from "./supabase";

// SERVER_URL vem de Constants.expoConfig.extra.serverUrl, populado pelo
// app.config.js lendo o .env da raiz. Não dá pra usar process.env.EXPO_PUBLIC_*
// porque o Metro inlina lendo de mobile/.env, e aqui o .env mora na raiz.
const SERVER_URL =
  (Constants.expoConfig?.extra?.serverUrl as string | undefined) ??
  "http://localhost:3000";
console.log("[socket] SERVER_URL:", SERVER_URL);

// Convenção do socket.io-client: ServerToClient vai primeiro (eventos
// que o cliente RECEBE), ClientToServer vai depois (eventos que EMITE).
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

// Token (JWT) enviado no handshake atual. `undefined` = socket ainda não fez
// nenhum handshake. O AuthProvider compara com o token do evento de auth pra
// decidir se precisa reconectar — sem isso, reconectava à toa no
// INITIAL_SESSION e derrubava a 1ª RPC do lobby (mesma raiz da web).
let currentHandshakeToken: string | null | undefined = undefined;

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
      // Reconexão automática — server reanexa a sala via clientId.
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 800,
      // Função async — avaliada a cada tentativa de conexão. Login/logout
      // ou refresh do JWT são refletidos sem recriar o socket. Espelha a
      // estratégia da web (web/src/net/socket.ts) que precisa esperar o
      // SDK do Supabase terminar de ler do storage antes do handshake.
      auth: (cb) => {
        void (async () => {
          const clientId = getClientId();
          const first = await supabase.auth.getSession();
          let session = first.data.session;
          if (!session) {
            // Force load/refresh — em RN o AsyncStorage é async, então
            // getSession() pode voltar null antes do _loadSession() interno.
            try {
              const r = await supabase.auth.refreshSession();
              if (r.data.session) session = r.data.session;
            } catch {
              // Sem sessão mesmo — segue anônimo.
            }
          }
          const accessToken = session?.access_token ?? null;
          console.log("[socket-auth]", {
            hasToken: !!accessToken,
            sessionUserId: session?.user?.id ?? null,
          });
          // Registra o token deste handshake pra o AuthProvider só reconectar
          // quando ele realmente mudar.
          currentHandshakeToken = accessToken;
          // platform: analytics — iOS ou Android (RN não roda na web aqui).
          cb({ clientId, accessToken, platform: Platform.OS === "ios" ? "ios" : "android" });
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

/**
 * Aguarda o handshake terminar antes de prosseguir. RPCs (api.ts) usam pra
 * não estourar timeout durante o boot — o callback de auth do socket faz
 * await em supabase.auth.getSession + refreshSession (lê AsyncStorage), o
 * que pode levar 1-2s no cold start. Sem essa espera, o primeiro listRooms
 * mostra "Sem conexão" falso.
 */
export const whenConnected = (timeoutMs = 6_000): Promise<void> => {
  const s = getSocket();
  if (s.connected) return Promise.resolve();
  if (!s.active) s.connect();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      s.off("connect", onConnect);
      reject(new Error("connect-timeout"));
    }, timeoutMs);
    const onConnect = () => {
      clearTimeout(timer);
      resolve();
    };
    s.once("connect", onConnect);
  });
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};

// Força disconnect+connect pra refletir mudança de auth state. Chamado
// pelo AuthProvider quando user loga/desloga. Sempre disconnect antes —
// se o socket estiver em mid-handshake com auth stale, só connect() é no-op.
export const reconnectSocket = () => {
  if (!socket) return;
  console.log("[reconnectSocket] forçando disconnect+connect");
  socket.disconnect();
  socket.connect();
};

export const getServerUrl = () => SERVER_URL;

// Token (JWT) usado no handshake atual. `undefined` = ainda não conectou
// (vai pegar o token certo sozinho no primeiro handshake, sem reconnect).
export const getHandshakeToken = (): string | null | undefined =>
  currentHandshakeToken;
