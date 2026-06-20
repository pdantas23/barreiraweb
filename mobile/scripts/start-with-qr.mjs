// Sobe o Expo (`expo start --lan`) e imprime um QR estático de
// exp://<IP-LAN>:<porta> — mas SÓ depois que o Metro estiver realmente pronto
// (polling no /status). Existe porque, rodando dentro do `concurrently`
// (npm run dev), o stdout não é um TTY e o Expo NÃO desenha o QR interativo
// (nem aceita as teclas i/a/r). O qrcode-terminal só imprime ASCII → funciona
// sem TTY. Esperar o Metro evita o "Could not connect to the server" de quem
// escaneia antes do servidor subir. Trade-offs: sem hotkeys e IP/porta
// resolvidos uma vez no boot.

import os from "node:os";
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const qrcode = require("qrcode-terminal");

// IP de LAN: primeiro IPv4 não-interno, preferindo faixas privadas comuns.
const lanIp = () => {
  const addrs = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === "IPv4" && !ni.internal) addrs.push(ni.address);
    }
  }
  return (
    addrs.find((a) => a.startsWith("192.168.")) ??
    addrs.find((a) => a.startsWith("10.")) ??
    addrs.find((a) => a.startsWith("172.")) ??
    addrs[0] ??
    "127.0.0.1"
  );
};

const port = Number(process.env.EXPO_PORT ?? process.env.RCT_METRO_PORT ?? 8081);
const url = `exp://${lanIp()}:${port}`;

// Margem (quiet zone) à esquerda de cada linha. Sob `concurrently`, cada linha
// ganha um prefixo "[mobile] " que colaria na borda do QR e mataria a quiet
// zone — esses espaços recriam a margem entre o prefixo e o QR.
const MARGIN = "      ";
const pad = (block) =>
  block
    .split("\n")
    .map((line) => MARGIN + line)
    .join("\n");

const printQr = () => {
  console.log("");
  console.log("  ┌─────────────────────────────────────────────┐");
  console.log("  │  ✅ Metro pronto — escaneie o QR no Expo Go   │");
  console.log("  │  (ou em Expo Go: 'Enter URL manually')        │");
  console.log("  └─────────────────────────────────────────────┘");
  qrcode.generate(url, { small: true }, (qr) => {
    console.log(pad(qr));
    console.log(`  ${url}`);
    console.log("  (sem hotkeys i/a/r aqui — rode 'npm --prefix mobile start' num");
    console.log("   terminal próprio se precisar do menu interativo do Expo)\n");
  });
};

// Faz polling no endpoint /status do Metro até responder "running".
const waitForMetro = () =>
  new Promise((resolve) => {
    const tick = () => {
      const req = http.get(
        { host: "127.0.0.1", port, path: "/status", timeout: 1500 },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () =>
            body.includes("packager-status:running")
              ? resolve()
              : setTimeout(tick, 1000),
          );
        },
      );
      req.on("error", () => setTimeout(tick, 1000));
      req.on("timeout", () => {
        req.destroy();
        setTimeout(tick, 1000);
      });
    };
    tick();
  });

console.log("  Subindo o Metro… o QR do Expo Go aparece quando estiver pronto.");

const child = spawn("npx", ["expo", "start", "--lan"], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
["SIGINT", "SIGTERM"].forEach((sig) =>
  process.on(sig, () => child.kill(sig)),
);

void waitForMetro().then(printQr);
