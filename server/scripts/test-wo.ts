// Critério Fase 5 — vitória por W.O. quando o oponente não volta:
// - 2 clientes (com clientId) iniciam partida
// - Host desconecta e NÃO retorna
// - Após o DISCONNECT_TIMEOUT_MS configurado no server, guest recebe:
//     - stateUpdate com winner = guest.enginePlayer
//     - gameOver com winner = guest.enginePlayer
//     - opponentLeft
//
// IMPORTANTE: pra esse teste ser rápido, suba o server com timeout curto:
//   DISCONNECT_TIMEOUT_MS=2000 npm run dev:server
//
// E rode esse script com a MESMA variável (pra ele saber quanto esperar):
//   DISCONNECT_TIMEOUT_MS=2000 npm --workspace=@barreira/server run test-wo

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  GameOverPayload,
  GameStartPayload,
  ServerToClientEvents,
} from "@barreira/shared";

const URL = process.env.URL ?? "http://localhost:3000";
const SERVER_TIMEOUT_MS = Number(process.env.DISCONNECT_TIMEOUT_MS ?? 30_000);
const WAIT_BUFFER_MS = 2_000;
const TOTAL_WAIT = SERVER_TIMEOUT_MS + WAIT_BUFFER_MS;
const CONNECT_TIMEOUT = 8_000;

type TClient = Socket<ServerToClientEvents, ClientToServerEvents>;

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error("✗ FAIL:", msg);
    process.exit(1);
  }
  console.log("✓", msg);
};

const log = (label: string, ...args: unknown[]) => console.log(`[${label}]`, ...args);

const connect = (label: string, auth: Record<string, string>): Promise<TClient> =>
  new Promise((resolve, reject) => {
    const s: TClient = io(URL, {
      transports: ["websocket"],
      reconnection: false,
      auth,
    });
    const t = setTimeout(() => reject(new Error(`${label}: timeout conectando`)), CONNECT_TIMEOUT);
    s.on("connect", () => {
      clearTimeout(t);
      log(label, `conectado`);
      resolve(s);
    });
    s.on("connect_error", reject);
  });

const onceEvent = <T>(s: TClient, event: string, timeoutMs: number): Promise<T> =>
  new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout esperando ${event}`)), timeoutMs);
    s.once(event as "gameOver", (payload) => {
      clearTimeout(t);
      res(payload as T);
    });
  });

const main = async () => {
  const HOST_CLIENT_ID = "host-" + Math.random().toString(36).slice(2, 10);
  const GUEST_CLIENT_ID = "guest-" + Math.random().toString(36).slice(2, 10);

  log("config", `server timeout esperado: ${SERVER_TIMEOUT_MS}ms`);
  if (SERVER_TIMEOUT_MS >= 30_000) {
    console.warn(
      "⚠ Timeout grande — esse teste vai esperar mais de 30s.",
      "Reinicia o server com DISCONNECT_TIMEOUT_MS=2000 pra rodar rápido.",
    );
  }

  const host = await connect("host", { clientId: HOST_CLIENT_ID });
  const guest = await connect("guest", { clientId: GUEST_CLIENT_ID });

  const create = await host.emitWithAck("createRoom", {
    hostName: "Host",
    color: "cyan",
    isPrivate: false,
  });
  if (!create.ok) {
    console.error("setup falhou:", create);
    process.exit(1);
  }

  const hostStartP = onceEvent<GameStartPayload>(host, "gameStart", CONNECT_TIMEOUT);
  const guestStartP = onceEvent<GameStartPayload>(guest, "gameStart", CONNECT_TIMEOUT);
  await guest.emitWithAck("joinRoom", { code: create.data.code, playerName: "Guest" });
  const [_hostStart, guestStart] = await Promise.all([hostStartP, guestStartP]);
  const guestEnginePlayer = guestStart.yourEnginePlayer;
  log("setup", `partida iniciada (guest = engine player ${guestEnginePlayer})`);

  // === Host desconecta e nunca volta ===
  // Registra listeners ANTES do disconnect — gameOver pode chegar segundos
  // depois e Node não tem buffer pra socket.io.
  const gameOverP = onceEvent<GameOverPayload>(guest, "gameOver", TOTAL_WAIT);
  const opponentLeftP = new Promise<void>((res) => guest.once("opponentLeft", () => res()));

  log("host", "desconectando e não voltando...");
  host.disconnect();
  log("guest", `esperando server timeout (~${SERVER_TIMEOUT_MS}ms)...`);

  const t0 = Date.now();
  const gameOver = await gameOverP;
  await opponentLeftP;
  const elapsed = Date.now() - t0;

  log("guest", `gameOver recebido após ${elapsed}ms`);
  assert(gameOver.winner === guestEnginePlayer, "winner = guest (W.O.)");
  assert(
    elapsed >= SERVER_TIMEOUT_MS - 500 && elapsed <= SERVER_TIMEOUT_MS + WAIT_BUFFER_MS,
    `timing dentro do esperado (${SERVER_TIMEOUT_MS}±${WAIT_BUFFER_MS}ms)`,
  );

  guest.disconnect();
  console.log("\n✓ Fase 5 (W.O.) OK — oponente vence quando o outro não volta.");
  process.exit(0);
};

main().catch((err) => {
  console.error("✗ Erro:", err);
  process.exit(1);
});
