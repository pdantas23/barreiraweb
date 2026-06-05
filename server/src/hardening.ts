// === Rate limiting / anti-flood (em memória) ===
//
// Tudo aqui é por-processo: cada instância conta só o próprio tráfego. Pro
// deploy atual (pm2 em fork único) isso cobre o caso real — flood de conexões
// inflando a tabela `players` e spam de eventos no socket. Multi-instância
// exigiria um store compartilhado (Redis); fora de escopo enquanto for 1 nó.
//
// Estratégia: janela deslizante simples por chave (IP pra conexão, socket.id
// pra eventos). Limites generosos por padrão pra não punir NAT de operadora /
// rede compartilhada — o alvo é o atacante abrindo centenas, não o usuário.

import type { Socket } from "socket.io";

// Janela deslizante: guarda timestamps por chave e diz se estourou o limite.
class SlidingWindow {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
  ) {}

  // Registra um hit em `now` (ms) e devolve true se a chave PASSOU do limite
  // dentro da janela — ou seja, este hit deve ser bloqueado.
  exceeded(key: string, now: number): boolean {
    const cutoff = now - this.windowMs;
    let arr = this.hits.get(key);
    if (!arr) {
      arr = [];
      this.hits.set(key, arr);
    }
    // Descarta timestamps fora da janela (estão no começo, pois é cronológico).
    let drop = 0;
    while (drop < arr.length && arr[drop] < cutoff) drop++;
    if (drop > 0) arr.splice(0, drop);
    arr.push(now);
    return arr.length > this.max;
  }

  // Remove chaves cujos hits já saíram todos da janela — evita vazar memória
  // com IPs/sockets que apareceram uma vez e sumiram.
  sweep(now: number): void {
    const cutoff = now - this.windowMs;
    for (const [key, arr] of this.hits) {
      let drop = 0;
      while (drop < arr.length && arr[drop] < cutoff) drop++;
      if (drop > 0) arr.splice(0, drop);
      if (arr.length === 0) this.hits.delete(key);
    }
  }
}

// --- Limites (ajustáveis por env) ---

// Conexões NOVAS por IP por minuto. 60 é folgado pra um humano (mesmo com
// reconexões), mas corta quem abre socket em loop pra floodar `players`.
const CONN_WINDOW_MS = 60_000;
const CONN_MAX = Number(process.env.RL_CONN_PER_MIN ?? 60);

// Eventos (chamadas RPC) por socket numa janela de 10s. Jogo é por turnos —
// um cliente legítimo manda poucos eventos/seg; 120/10s (=12/s) é teto alto.
const EVENT_WINDOW_MS = 10_000;
const EVENT_MAX = Number(process.env.RL_EVENTS_PER_10S ?? 120);

const connWindow = new SlidingWindow(CONN_WINDOW_MS, CONN_MAX);
const eventWindow = new SlidingWindow(EVENT_WINDOW_MS, EVENT_MAX);

// IP real do cliente. Atrás do nginx vem em X-Forwarded-For / X-Real-IP (o
// nginx do projeto seta os dois). Sem proxy, cai no address do handshake.
const ipFromSocket = (socket: Socket): string => {
  const xff = socket.handshake.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    // Pode vir "client, proxy1, proxy2" — o primeiro é o cliente real.
    return xff.split(",")[0]!.trim();
  }
  if (Array.isArray(xff) && xff.length > 0) return xff[0]!.trim();
  const real = socket.handshake.headers["x-real-ip"];
  if (typeof real === "string" && real.length > 0) return real;
  return socket.handshake.address || "unknown";
};

// Para o io.use(): true se a conexão pode prosseguir. Loga quando bloqueia.
export const connectionAllowed = (socket: Socket, now: number): boolean => {
  const ip = ipFromSocket(socket);
  if (connWindow.exceeded(ip, now)) {
    console.warn(`[flood] conexões demais de ${ip} (>${CONN_MAX}/min) — recusando`);
    return false;
  }
  return true;
};

// Para o wrapper rpc(): true se o evento pode ser processado. Loga ao bloquear.
export const eventAllowed = (socket: Socket, now: number): boolean => {
  if (eventWindow.exceeded(socket.id, now)) {
    console.warn(
      `[flood] eventos demais de ${socket.id} (>${EVENT_MAX}/${EVENT_WINDOW_MS / 1000}s) — throttling`,
    );
    return false;
  }
  return true;
};

// Limpeza periódica das janelas pra não acumular chaves mortas. Chamar uma vez
// no boot. O timer é unref pra não segurar o processo vivo sozinho.
export const startHardeningSweeper = (): void => {
  const timer = setInterval(() => {
    const now = Date.now();
    connWindow.sweep(now);
    eventWindow.sweep(now);
  }, 60_000);
  timer.unref();
};
