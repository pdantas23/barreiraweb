// Critério de teste da Fase 1 / Passo 5:
// cliente conecta no server, manda ping, recebe pong + ack, desconecta.
//
// Rodar (com o server já no ar em outro terminal):
//   npm run test-client                  (dentro de server/)
//   ou:  npx tsx server/scripts/test-client.ts

import { io } from "socket.io-client";

const URL = process.env.URL ?? "http://localhost:3000";
const TIMEOUT_MS = 5_000;

console.log(`Conectando em ${URL}...`);
const socket = io(URL, {
  transports: ["websocket"],
  reconnection: false,
});

let pongReceived = false;
let ackReceived = false;

const finishOk = () => {
  console.log("\n✓ Fase 1 OK — server fala socket.io.");
  socket.disconnect();
  process.exit(0);
};

const failTimeout = setTimeout(() => {
  console.error(`✗ Timeout: server não respondeu em ${TIMEOUT_MS}ms.`);
  console.error(`  pong recebido: ${pongReceived}, ack recebido: ${ackReceived}`);
  process.exit(1);
}, TIMEOUT_MS);

socket.on("connect", () => {
  console.log(`✓ Conectado. socket.id = ${socket.id}`);

  socket.emit("ping", { hello: "world", clientTs: Date.now() }, (resp: unknown) => {
    console.log("✓ Ack recebido:", resp);
    ackReceived = true;
    if (pongReceived) {
      clearTimeout(failTimeout);
      finishOk();
    }
  });
});

socket.on("pong", (payload: unknown) => {
  console.log("✓ Pong recebido:", payload);
  pongReceived = true;
  if (ackReceived) {
    clearTimeout(failTimeout);
    finishOk();
  }
});

socket.on("connect_error", (err) => {
  console.error("✗ Erro de conexão:", err.message);
  console.error("  (o server está rodando? `npm run dev:server` na raiz)");
  process.exit(1);
});
