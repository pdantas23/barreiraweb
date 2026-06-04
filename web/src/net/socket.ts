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

// Token (JWT) que foi enviado no handshake atual do socket. `undefined` =
// socket ainda não fez nenhum handshake. O AuthProvider compara este valor
// com o token do evento de auth pra decidir se precisa mesmo reconectar —
// sem isso, reconectava à toa no INITIAL_SESSION e derrubava a 1ª RPC.
let currentHandshakeToken: string | null | undefined = undefined;

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
          const t0 = Date.now();
          const first = await supabase.auth.getSession();
          let session = first.data.session;
          let refreshed = false;
          let refreshError: string | null = null;
          if (!session) {
            // Tenta forçar o SDK a carregar a sessão do storage / dar
            // refresh. Ignora erro silenciosamente — se não tem sessão
            // mesmo, segue como anônimo.
            try {
              const r = await supabase.auth.refreshSession();
              refreshed = true;
              if (r.error) refreshError = r.error.message;
              if (r.data.session) session = r.data.session;
            } catch (err) {
              refreshError = err instanceof Error ? err.message : String(err);
            }
          }
          const accessToken = session?.access_token ?? null;
          // Log de diagnóstico SEM dados sensíveis (sem token, sem user id,
          // sem chaves do storage) — só sinais booleanos e tempo.
          console.log("[socket-auth]", {
            hasToken: !!accessToken,
            firstSessionFound: !!first.data.session,
            refreshed,
            refreshError,
            ms: Date.now() - t0,
          });
          // Registra o token deste handshake pra o AuthProvider saber se um
          // futuro auth-state-change realmente muda o token (e só então
          // reconectar).
          currentHandshakeToken = accessToken;
          // platform: analytics — identifica de onde a partida veio.
          cb({ clientId, accessToken, platform: "web" });
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
 * Espera o socket estar conectado antes de prosseguir. Usado pelos wrappers
 * de RPC pra não disparar emitWithAck antes do handshake terminar — se
 * disparar, o socket buffera mas o callback de auth (que faz await em
 * supabase.auth.getSession + refreshSession) pode demorar segundos, e o
 * timeout do safeRpc dispara antes mostrando "Sem conexão" no boot.
 *
 * Resolve imediato se já conectado. Rejeita após timeoutMs se nunca conectar.
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

// Forca o socket a desconectar+reconectar pra refletir mudanca de auth state.
// Chamado pelo AuthProvider quando o usuario loga/desloga.
//
// Sempre dá disconnect antes — se o socket estiver em estado "connecting"
// (mid-handshake) com auth stale, só chamar connect() é no-op e o
// handshake antigo termina com auth desatualizado.
export const reconnectSocket = () => {
  if (!socket) {
    console.log("[reconnectSocket] socket ainda não criado — no-op");
    return;
  }
  console.log("[reconnectSocket] forçando disconnect+connect, estado atual:", {
    connected: socket.connected,
    id: socket.id,
  });
  socket.disconnect();
  socket.connect();
};

export const getServerUrl = () => SERVER_URL;

// Token (JWT) usado no handshake atual. `undefined` = ainda não conectou
// (vai pegar o token certo sozinho no primeiro handshake, sem reconnect).
export const getHandshakeToken = (): string | null | undefined =>
  currentHandshakeToken;
