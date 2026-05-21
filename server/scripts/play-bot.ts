// === Adversário robô via terminal ===
//
// Uso típico (quando só você tem 1 celular):
//   1. Sobe o server: npm run dev:server
//   2. No app: cria sala online, copia o código (ex: AX42KP)
//   3. Em outro terminal:  CODE=AX42KP npm run play-bot
//   4. O bot entra na sua sala e joga contra você até alguém vencer.
//
// Configuração via env:
//   CODE=XXXXXX  (obrigatório — código da sala)
//   LEVEL=easy|medium|hard   (default: medium)
//   NAME=BotPlayer           (nome que vai aparecer pro humano)
//   URL=http://...           (default: http://localhost:3000)
//   THINK_MS=700             (delay antes de jogar, pra parecer humano)
//   PASSWORD=XXXXXX          (se a sala for privada)

import { io, type Socket } from "socket.io-client";
import {
  deserializeState,
  easyOpponentMove,
  minimaxOpponentMove,
  smartOpponentMove,
  type ClientToServerEvents,
  type GameState,
  type Move,
  type PlayerId,
  type ServerToClientEvents,
} from "@barreira/shared";

const URL = process.env.URL ?? "http://localhost:3000";
const CODE = process.env.CODE;
const LEVEL = (process.env.LEVEL ?? "medium").toLowerCase();
const NAME = process.env.NAME ?? "BotPlayer";
const THINK_MS = Number(process.env.THINK_MS ?? 700);
const PASSWORD = process.env.PASSWORD;

if (!CODE) {
  console.error("✗ Defina a variável CODE com o código da sala.");
  console.error("  ex: CODE=AX42KP npm run play-bot");
  console.error("  ex (sala privada): CODE=AX42KP PASSWORD=ZQ08MN npm run play-bot");
  console.error("  ex (difícil):      CODE=AX42KP LEVEL=hard npm run play-bot");
  process.exit(1);
}

const pickBot = (level: string) => {
  if (level === "easy") return { fn: easyOpponentMove, label: "Fácil" };
  if (level === "hard") return { fn: minimaxOpponentMove, label: "Difícil" };
  return { fn: smartOpponentMove, label: "Médio" };
};

const { fn: bot, label: levelLabel } = pickBot(LEVEL);

type TClient = Socket<ServerToClientEvents, ClientToServerEvents>;

const socket: TClient = io(URL, {
  transports: ["websocket"],
  reconnection: false,
});

// Estado local — mantido em sincronia com os pushes do server.
let myEnginePlayer: PlayerId | null = null;
let currentState: GameState | null = null;
let playing = false; // flag pra evitar disparar 2 jogadas no mesmo turno

// Quando recebe um state e é a vez do bot, agenda uma jogada.
const maybePlay = async () => {
  if (playing) return;
  if (!currentState || myEnginePlayer === null) return;
  if (currentState.winner !== null) return;
  if (currentState.turn !== myEnginePlayer) return;

  playing = true;
  await new Promise((r) => setTimeout(r, THINK_MS));

  // Snapshot defensivo: state pode ter mudado durante o think (improvável
  // já que turno trava o oponente, mas é barato garantir).
  if (!currentState || myEnginePlayer === null || currentState.turn !== myEnginePlayer) {
    playing = false;
    return;
  }

  const move = bot(currentState, myEnginePlayer);
  if (!move) {
    console.error("✗ Bot não conseguiu gerar movimento — abandonando.");
    process.exit(1);
  }
  console.log(`🤖 jogando: ${describeMove(move)}`);
  const res = await socket.emitWithAck("move", { move });
  if (!res.ok) {
    console.error(`✗ Server rejeitou (${res.error}): ${res.message ?? ""}`);
  }
  playing = false;
};

const describeMove = (move: Move): string => {
  if (move.kind === "piece") return `peça → ${move.to}`;
  const { type, interRow, interCol } = move.placement;
  return `parede ${type.toUpperCase()} em (${interRow},${interCol})`;
};

socket.on("connect", async () => {
  console.log(`✓ Conectado em ${URL} como "${NAME}".`);
  console.log(`   Nível: ${levelLabel}. Entrando em ${CODE}...`);
  const res = await socket.emitWithAck("joinRoom", {
    code: CODE,
    playerName: NAME,
    password: PASSWORD,
  });
  if (!res.ok) {
    console.error(`✗ Falha ao entrar (${res.error}): ${res.message ?? ""}`);
    process.exit(1);
  }
  console.log(`✓ Entrou na sala. Aguardando gameStart...`);
});

socket.on("gameStart", (payload) => {
  myEnginePlayer = payload.yourEnginePlayer;
  currentState = deserializeState(payload.state);
  console.log(
    `🎮 Partida começou! Você joga contra "${NAME}" (cor ${payload.yourColor === "cyan" ? "vermelha" : "ciano"}, bot ${levelLabel}).`,
  );
  console.log(`   Eu sou engine P${myEnginePlayer} (${payload.yourColor}).`);
  void maybePlay();
});

socket.on("stateUpdate", (payload) => {
  currentState = deserializeState(payload.state);
  const turn = currentState.turn;
  console.log(
    `   ← state: turn=P${turn} | p1=${currentState.p1} p2=${currentState.p2} | paredes ${currentState.wallsLeft[1]}/${currentState.wallsLeft[2]}`,
  );
  void maybePlay();
});

socket.on("gameOver", (payload) => {
  const won = payload.winner === myEnginePlayer;
  console.log(won ? "\n🤖 Eu venci!" : "\n🎉 Você venceu!");
  setTimeout(() => process.exit(0), 500);
});

socket.on("opponentLeft", () => {
  console.log("\n👋 Você saiu da sala. Bot desconectando.");
  setTimeout(() => process.exit(0), 200);
});

socket.on("connect_error", (err) => {
  console.error("✗ Erro de conexão:", err.message);
  console.error(`  (o server está rodando em ${URL}?)`);
  process.exit(1);
});
