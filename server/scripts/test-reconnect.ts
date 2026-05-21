// Critério Fase 5 — reconexão preservando state:
// - Host conecta com clientId → cria sala → guest entra → partida começa
// - Host joga 1 movimento (state agora tem p1=67)
// - Host desconecta abruptamente
// - Guest NÃO recebe opponentLeft (host está em modo reconectável)
// - Host abre socket NOVO (id diferente) com o MESMO clientId
// - Server reanexa: novo socket recebe gameStart com state atual (p1=67)
// - Host faz uma segunda jogada → broadcasta normal pra ambos
//
// Rodar (com server no ar):
//   npm --workspace=@barreira/server run test-reconnect

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  GameStartPayload,
  ServerToClientEvents,
  StateUpdatePayload,
} from "@barreira/shared";

const URL = process.env.URL ?? "http://localhost:3000";
const TIMEOUT_MS = 8_000;

type TClient = Socket<ServerToClientEvents, ClientToServerEvents>;

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error("✗ FAIL:", msg);
    process.exit(1);
  }
  console.log("✓", msg);
};

const log = (label: string, ...args: unknown[]) => console.log(`[${label}]`, ...args);

const connect = (label: string, auth?: Record<string, string>): Promise<TClient> =>
  new Promise((resolve, reject) => {
    const s: TClient = io(URL, {
      transports: ["websocket"],
      reconnection: false,
      auth,
    });
    const t = setTimeout(() => reject(new Error(`${label}: timeout conectando`)), TIMEOUT_MS);
    s.on("connect", () => {
      clearTimeout(t);
      log(label, `conectado (${s.id})`);
      resolve(s);
    });
    s.on("connect_error", reject);
  });

const onceEvent = <K extends keyof ServerToClientEvents>(
  s: TClient,
  event: K,
): Promise<Parameters<ServerToClientEvents[K]>[0]> =>
  new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout esperando ${String(event)}`)), TIMEOUT_MS);
    s.once(event as "gameStart", (payload) => {
      clearTimeout(t);
      res(payload as Parameters<ServerToClientEvents[K]>[0]);
    });
  });

const main = async () => {
  const HOST_CLIENT_ID = "host-" + Math.random().toString(36).slice(2, 10);
  const GUEST_CLIENT_ID = "guest-" + Math.random().toString(36).slice(2, 10);

  // === Setup partida ===
  const host = await connect("host", { clientId: HOST_CLIENT_ID });
  const guest = await connect("guest", { clientId: GUEST_CLIENT_ID });

  const create = await host.emitWithAck("createRoom", {
    hostName: "Host",
    color: "cyan",
    isPrivate: false,
  });
  assert(create.ok, "host criou sala");
  if (!create.ok) return;
  const code = create.data.code;

  const hostStartP = onceEvent(host, "gameStart") as Promise<GameStartPayload>;
  const guestStartP = onceEvent(guest, "gameStart") as Promise<GameStartPayload>;
  await guest.emitWithAck("joinRoom", { code, playerName: "Guest" });
  await Promise.all([hostStartP, guestStartP]);
  log("setup", `partida iniciada em ${code}`);

  // === Host joga 1 movimento ===
  const guestUpdate1 = onceEvent(guest, "stateUpdate") as Promise<StateUpdatePayload>;
  const moveAck = await host.emitWithAck("move", { move: { kind: "piece", to: 67 } });
  assert(moveAck.ok, "host jogou 76→67");
  const stateAfter1 = await guestUpdate1;
  assert(stateAfter1.state.p1 === 67, "guest viu p1=67 antes do disconnect");

  // === Guest joga também — passa a vez de volta pro host ===
  // (sem isso, quando host reconectar ainda seria turn=2 e ele não conseguiria
  // jogar pra demonstrar o canal funcionando).
  const hostUpdateMid = onceEvent(host, "stateUpdate") as Promise<StateUpdatePayload>;
  await guest.emitWithAck("move", { move: { kind: "piece", to: 5 } });
  await hostUpdateMid;

  // === Host desconecta abruptamente ===
  let opponentLeftFired = false;
  guest.once("opponentLeft", () => {
    opponentLeftFired = true;
  });

  log("host", "desconectando...");
  host.disconnect();
  // Pequeno respiro pra server processar disconnect; muito menor que o timeout.
  await new Promise((r) => setTimeout(r, 300));
  assert(!opponentLeftFired, "guest NÃO recebeu opponentLeft (modo reconectável)");

  // === Novo socket com MESMO clientId — server deve reanexar ===
  log("host", "reconectando com mesmo clientId...");
  const host2 = await connect("host*", { clientId: HOST_CLIENT_ID });

  // O reanchor dispara um gameStart pro novo socket. Pode ter chegado
  // entre o connect e o registro do listener — usar listener pré-registrado.
  // Workaround simples: aguardar 200ms e ver se já chegou. Aqui registro
  // ANTES do connect ter completado seria ideal, mas como `connect` resolve
  // após o handshake (e gameStart vem depois), registrar agora é OK.
  const restoredStart = await onceEvent(host2, "gameStart") as GameStartPayload;
  assert(restoredStart.state.p1 === 67, "host* recebeu gameStart com state restaurado (p1=67)");
  assert(restoredStart.yourEnginePlayer === 1, "host* continua sendo engine player 1");
  log("host*", "state restaurado:", restoredStart.state);

  // === Segunda jogada — confirma que o novo socket consegue jogar ===
  const guestUpdate2 = onceEvent(guest, "stateUpdate") as Promise<StateUpdatePayload>;
  const moveAck2 = await host2.emitWithAck("move", { move: { kind: "piece", to: 58 } });
  assert(moveAck2.ok, "host* conseguiu jogar 67→58 após reconectar");
  const stateAfter2 = await guestUpdate2;
  assert(stateAfter2.state.p1 === 58, "guest viu p1=58 após o reanchor");

  host2.disconnect();
  guest.disconnect();
  console.log("\n✓ Fase 5 (reconexão) OK — reanchor preserva state e identidade.");
  process.exit(0);
};

main().catch((err) => {
  console.error("✗ Erro:", err);
  process.exit(1);
});
