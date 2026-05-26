// Critério da Fase 3:
// - move válido aplica e broadcasta stateUpdate pros 2 sockets
// - move fora da vez retorna ack "not-your-turn", state inalterado
// - move ilegal (engine rejeita) retorna ack "invalid-move", state inalterado
// - sequência de jogadas chega na vitória → gameOver pros 2 com winner correto
//
// Rodar (server precisa estar no ar):
//   npm --workspace=@barreira/server run test-game

import { io, type Socket } from "socket.io-client";
import {
  deserializeState,
  type ClientToServerEvents,
  type GameOverPayload,
  type Move,
  type RoomDetail,
  type RpcResult,
  type ServerToClientEvents,
  type StateUpdatePayload,
} from "@barreira/shared";

const URL = process.env.URL ?? "http://localhost:3000";
const TIMEOUT_MS = 8_000;

type TClient = Socket<ServerToClientEvents, ClientToServerEvents>;

const log = (label: string, ...args: unknown[]) =>
  console.log(`[${label}]`, ...args);

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error("✗ FAIL:", msg);
    process.exit(1);
  }
  console.log("✓", msg);
};

const connect = (label: string): Promise<TClient> =>
  new Promise((resolve, reject) => {
    const s: TClient = io(URL, { transports: ["websocket"], reconnection: false });
    const t = setTimeout(() => reject(new Error(`${label}: timeout conectando`)), TIMEOUT_MS);
    s.on("connect", () => {
      clearTimeout(t);
      log(label, `conectado (${s.id})`);
      resolve(s);
    });
    s.on("connect_error", reject);
  });

// Espera UM stateUpdate em cada socket. Crucial registrar ANTES de mandar
// a jogada, senão o evento chega entre o ack e o .once e a gente perde.
const expectStateUpdate = (s: TClient): Promise<StateUpdatePayload> =>
  new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("timeout stateUpdate")), TIMEOUT_MS);
    s.once("stateUpdate", (p) => {
      clearTimeout(t);
      res(p);
    });
  });

const expectGameOver = (s: TClient): Promise<GameOverPayload> =>
  new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("timeout gameOver")), TIMEOUT_MS);
    s.once("gameOver", (p) => {
      clearTimeout(t);
      res(p);
    });
  });

// Faz uma jogada legal e confirma que os 2 sockets recebem stateUpdate consistente.
const playLegal = async (
  mover: TClient,
  other: TClient,
  move: Move,
  label: string,
) => {
  const moverUpdate = expectStateUpdate(mover);
  const otherUpdate = expectStateUpdate(other);
  const ack = await mover.emitWithAck("move", { move });
  assert(ack.ok, `${label}: ack ok`);
  const [a, b] = await Promise.all([moverUpdate, otherUpdate]);
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    `${label}: state idêntico nos 2 sockets`,
  );
  return deserializeState(a.state);
};

const main = async () => {
  const [host, guest] = await Promise.all([connect("host"), connect("guest")]);

  // Setup sala + start
  const createRes: RpcResult<RoomDetail> = await host.emitWithAck("createRoom", {
    hostName: "Host",
    color: "cyan",
    isPrivate: false,
  });
  assert(createRes.ok, "criou sala");
  if (!createRes.ok) return;
  const code = createRes.data.code;

  const hostStart = new Promise<void>((r) => host.once("gameStart", () => r()));
  const guestStart = new Promise<void>((r) => guest.once("gameStart", () => r()));
  const joinRes = await guest.emitWithAck("joinRoom", {
    code,
    playerName: "Guest",
  });
  assert(joinRes.ok, "guest entrou");
  await Promise.all([hostStart, guestStart]);

  // Countdown de 3s antes do primeiro move (cfba39f). Espera passar.
  await new Promise((r) => setTimeout(r, 3_500));

  // === 1) Jogada legal de P1 ===
  let state = await playLegal(host, guest, { kind: "piece", to: 67 }, "T1 P1 76→67");
  assert(state.p1 === 67, "P1 está em 67");
  assert(state.turn === 2, "turn passou pra P2");

  // === 2) P1 tenta jogar de novo (fora da vez) ===
  const wrongTurn = await host.emitWithAck("move", { move: { kind: "piece", to: 58 } });
  assert(!wrongTurn.ok, "fora da vez é rejeitada");
  if (!wrongTurn.ok) {
    assert(wrongTurn.error === "not-your-turn", `erro correto: ${wrongTurn.error}`);
  }

  // === 3) P2 tenta jogada ilegal (pular 3 casas de uma vez) ===
  const illegal = await guest.emitWithAck("move", { move: { kind: "piece", to: 31 } });
  assert(!illegal.ok, "jogada inválida é rejeitada");
  if (!illegal.ok) {
    assert(illegal.error === "invalid-move", `erro correto: ${illegal.error}`);
  }

  // === 4) P2 joga legal (sai pra direita pra não bloquear P1) ===
  state = await playLegal(guest, host, { kind: "piece", to: 5 }, "T2 P2 4→5");

  // === 5) Caminho até vitória ===
  // P1 sobe pela coluna 4, P2 desce pela coluna 5. Sem colisão.
  const seq: Array<{ side: "host" | "guest"; move: Move }> = [
    { side: "host", move: { kind: "piece", to: 58 } },  // T3 P1 67→58
    { side: "guest", move: { kind: "piece", to: 14 } }, // T4 P2 5→14
    { side: "host", move: { kind: "piece", to: 49 } },  // T5 P1 58→49
    { side: "guest", move: { kind: "piece", to: 23 } }, // T6
    { side: "host", move: { kind: "piece", to: 40 } },  // T7
    { side: "guest", move: { kind: "piece", to: 32 } }, // T8
    { side: "host", move: { kind: "piece", to: 31 } },  // T9
    { side: "guest", move: { kind: "piece", to: 41 } }, // T10
    { side: "host", move: { kind: "piece", to: 22 } },  // T11
    { side: "guest", move: { kind: "piece", to: 50 } }, // T12
    { side: "host", move: { kind: "piece", to: 13 } },  // T13
    { side: "guest", move: { kind: "piece", to: 59 } }, // T14
  ];
  for (const { side, move } of seq) {
    const [mover, other] = side === "host" ? [host, guest] : [guest, host];
    state = await playLegal(mover, other, move, `${side} ${JSON.stringify(move)}`);
  }
  assert(state.p1 === 13 && state.p2 === 59, "posições antes da vitória corretas");
  assert(state.winner === null, "ninguém venceu ainda");

  // === 6) Movimento ganhador de P1: 13 → 4 (row 0) ===
  const hostOver = expectGameOver(host);
  const guestOver = expectGameOver(guest);
  const hostUpdate = expectStateUpdate(host);
  const guestUpdate = expectStateUpdate(guest);

  const ack = await host.emitWithAck("move", { move: { kind: "piece", to: 4 } });
  assert(ack.ok, "jogada ganhadora aceita");

  const [hOver, gOver] = await Promise.all([hostOver, guestOver]);
  await Promise.all([hostUpdate, guestUpdate]);
  assert(hOver.winner === 1, "host recebeu gameOver com winner=1");
  assert(gOver.winner === 1, "guest recebeu gameOver com winner=1");

  // === 7) Após gameOver, tentar mover → "game-over" ===
  const afterOver = await guest.emitWithAck("move", { move: { kind: "piece", to: 68 } });
  assert(!afterOver.ok, "movimento após gameOver é rejeitado");
  if (!afterOver.ok) {
    assert(afterOver.error === "game-over", `erro correto: ${afterOver.error}`);
  }

  host.disconnect();
  guest.disconnect();
  console.log("\n✓ Fase 3 OK — partida autoritativa, sincronização e gameOver funcionando.");
  process.exit(0);
};

main().catch((err) => {
  console.error("✗ Erro:", err);
  process.exit(1);
});
