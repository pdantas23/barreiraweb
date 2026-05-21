// Critério da Fase 2:
// - Cliente A cria sala. Cliente B lista, vê a sala, entra.
// - Ambos recebem gameStart com `yourEnginePlayer` diferente (1 e 2).
// - O state inicial é idêntico nos 2 lados.
//
// Rodar (server precisa estar no ar):
//   npm --workspace=@barreira/server run test-room

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  CreateRoomPayload,
  GameStartPayload,
  JoinRoomPayload,
  ListRoomsPayload,
  RoomDetail,
  RpcResult,
  ServerToClientEvents,
} from "@barreira/shared";

const URL = process.env.URL ?? "http://localhost:3000";
const TIMEOUT_MS = 8_000;

// Convenção do socket.io-client: o ServerToClient vai primeiro.
type TClient = Socket<ServerToClientEvents, ClientToServerEvents>;

const log = (label: string, ...args: unknown[]) =>
  console.log(`[${label}]`, ...args);

const connect = (label: string): Promise<TClient> =>
  new Promise((resolve, reject) => {
    const s: TClient = io(URL, { transports: ["websocket"], reconnection: false });
    const t = setTimeout(() => reject(new Error(`${label}: timeout conectando`)), TIMEOUT_MS);
    s.on("connect", () => {
      clearTimeout(t);
      log(label, `conectado (${s.id})`);
      resolve(s);
    });
    s.on("connect_error", (err) => {
      clearTimeout(t);
      reject(err);
    });
  });

// Promise wrapper de emitWithAck pra RPCs tipadas.
const create = (s: TClient, payload: CreateRoomPayload): Promise<RpcResult<RoomDetail>> =>
  s.emitWithAck("createRoom", payload);
const join = (s: TClient, payload: JoinRoomPayload): Promise<RpcResult<RoomDetail>> =>
  s.emitWithAck("joinRoom", payload);
const list = (s: TClient, payload: ListRoomsPayload) =>
  s.emitWithAck("listRooms", payload);

// Espera o servidor pushar gameStart no socket.
const waitGameStart = (s: TClient, label: string): Promise<GameStartPayload> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label}: timeout esperando gameStart`)),
      TIMEOUT_MS,
    );
    s.once("gameStart", (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error("✗ FAIL:", msg);
    process.exit(1);
  }
  console.log("✓", msg);
};

const main = async () => {
  // Conecta os 2 clientes em paralelo.
  const [hostSock, guestSock] = await Promise.all([
    connect("host"),
    connect("guest"),
  ]);

  // Host cria sala pública, cor cyan.
  const createRes = await create(hostSock, {
    hostName: "TesteHost",
    color: "cyan",
    isPrivate: false,
  });
  assert(createRes.ok, "host conseguiu criar sala");
  if (!createRes.ok) return;
  const code = createRes.data.code;
  log("host", "sala criada:", code, createRes.data);

  // Já configura listener de gameStart ANTES de o guest entrar — assim
  // não corremos risco de perder o push se chegar antes do .once registrar.
  const hostGameStart = waitGameStart(hostSock, "host");

  // Guest lista e confirma que vê a sala.
  const listRes = await list(guestSock, {});
  assert(listRes.ok, "guest conseguiu listar salas");
  if (!listRes.ok) return;
  assert(
    listRes.data.rooms.some((r) => r.code === code),
    `guest vê a sala ${code} na lista`,
  );

  const guestGameStart = waitGameStart(guestSock, "guest");

  // Guest entra na sala.
  const joinRes = await join(guestSock, {
    code,
    playerName: "TesteGuest",
  });
  assert(joinRes.ok, "guest conseguiu entrar na sala");

  // Os dois lados devem receber gameStart.
  const [hStart, gStart] = await Promise.all([hostGameStart, guestGameStart]);
  log("host", "gameStart:", {
    yourEnginePlayer: hStart.yourEnginePlayer,
    yourColor: hStart.yourColor,
    opponent: hStart.opponentName,
    placements: hStart.state.placements.length,
  });
  log("guest", "gameStart:", {
    yourEnginePlayer: gStart.yourEnginePlayer,
    yourColor: gStart.yourColor,
    opponent: gStart.opponentName,
    placements: gStart.state.placements.length,
  });

  // === Validações principais ===
  assert(hStart.yourEnginePlayer === 1, "host é engine player 1 (sai de baixo)");
  assert(gStart.yourEnginePlayer === 2, "guest é engine player 2");
  assert(
    hStart.yourEnginePlayer !== gStart.yourEnginePlayer,
    "os dois jogadores têm IDs diferentes",
  );
  assert(hStart.yourColor === "cyan", "host pegou a cor que pediu (cyan)");
  assert(gStart.yourColor === "red", "guest pegou a cor oposta (red)");
  assert(hStart.opponentName === "TesteGuest", "host vê nome do guest correto");
  assert(gStart.opponentName === "TesteHost", "guest vê nome do host correto");

  // Estado inicial deve ser idêntico nos 2 lados.
  assert(hStart.state.p1 === gStart.state.p1, "p1 igual nos dois lados");
  assert(hStart.state.p2 === gStart.state.p2, "p2 igual nos dois lados");
  // randomFirstTurn pode sortear P1 ou P2 — só validamos que está num desses 2.
  assert(hStart.state.turn === 1 || hStart.state.turn === 2, "turn inicial é 1 ou 2");
  assert(hStart.state.turn === gStart.state.turn, "ambos veem o mesmo turn inicial");
  assert(hStart.state.placements.length === 0, "tabuleiro vazio no início");
  assert(hStart.state.wallsLeft[1] === 10 && hStart.state.wallsLeft[2] === 10, "10 paredes cada");

  // === Cleanup ===
  hostSock.disconnect();
  guestSock.disconnect();
  console.log("\n✓ Fase 2 OK — lobby + gameStart funcionando.");
  process.exit(0);
};

main().catch((err) => {
  console.error("✗ Erro:", err);
  process.exit(1);
});
