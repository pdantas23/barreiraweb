import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Testa a fila de matchmaking isoladamente: o módulo recebe as operações
// concretas (criar sala + bot + emits) via initMatchmaking, então mockamos
// essas deps e verificamos só a lógica da fila. Timers fake pro fallback do bot.

type MM = typeof import("./matchmaking.js");
let mm: MM;

const deps = {
  createHumanMatch: vi.fn(() => ({ code: "ROOM01", password: "PW01" })),
  createBotMatch: vi.fn(() => ({ code: "BOT01", botName: "felipe_mota" })),
  emitMatchFound: vi.fn(),
  emitStatus: vi.fn(),
};

const player = (n: number) => ({
  socketId: `s${n}`,
  clientId: `c${n}`,
  authUserId: `u${n}`,
  name: `Jogador${n}`,
  platform: null,
  joinedAt: Date.now(),
});

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  deps.createHumanMatch.mockClear();
  deps.createBotMatch.mockClear();
  deps.emitMatchFound.mockClear();
  deps.emitStatus.mockClear();
  mm = await import("./matchmaking.js");
  mm.initMatchmaking(deps);
});

afterEach(() => {
  mm._resetMatchmaking();
  vi.useRealTimers();
});

describe("matchmaking", () => {
  it("dois jogadores reais → match criado, ambos notificados", () => {
    const a = player(1);
    const b = player(2);
    mm.joinMatchmaking(a);
    expect(mm.queueSize()).toBe(1);

    mm.joinMatchmaking(b);

    expect(deps.createHumanMatch).toHaveBeenCalledWith(a, b);
    expect(deps.emitMatchFound).toHaveBeenCalledTimes(2);
    // host (a) recebe o nome do guest e sem senha; guest (b) recebe a senha.
    expect(deps.emitMatchFound).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ roomCode: "ROOM01", opponentName: "Jogador2", isBot: false }),
    );
    expect(deps.emitMatchFound).toHaveBeenCalledWith(
      "s2",
      expect.objectContaining({ roomCode: "ROOM01", opponentName: "Jogador1", password: "PW01", isBot: false }),
    );
    expect(mm.queueSize()).toBe(0);
  });

  it("timeout sem par → bot adicionado, sala criada, jogador notificado", () => {
    const a = player(1);
    mm.joinMatchmaking(a);

    vi.advanceTimersByTime(mm.getMatchTimeoutMs() + 50);

    expect(deps.createBotMatch).toHaveBeenCalledWith(a);
    expect(deps.createHumanMatch).not.toHaveBeenCalled();
    expect(deps.emitMatchFound).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ roomCode: "BOT01", opponentName: "felipe_mota", isBot: true }),
    );
    expect(mm.queueSize()).toBe(0);
  });

  it("leaveMatchmaking remove da fila e NÃO cria sala depois", () => {
    const a = player(1);
    mm.joinMatchmaking(a);
    expect(mm.leaveMatchmaking("s1")).toBe(true);
    expect(mm.queueSize()).toBe(0);

    vi.advanceTimersByTime(mm.getMatchTimeoutMs() + 50);

    expect(deps.createBotMatch).not.toHaveBeenCalled();
    expect(deps.emitMatchFound).not.toHaveBeenCalled();
  });

  it("leaveMatchmaking de quem não está na fila devolve false", () => {
    expect(mm.leaveMatchmaking("inexistente")).toBe(false);
  });

  it("anti-spam: segundo joinMatchmaking do mesmo socket lança erro", () => {
    const a = player(1);
    mm.joinMatchmaking(a);
    expect(() => mm.joinMatchmaking({ ...a, joinedAt: Date.now() })).toThrowError(/already-in-queue/);
    expect(mm.queueSize()).toBe(1);
  });

  it("anti-spam: mesma conta (authUserId) em outro socket também é barrada", () => {
    const a = player(1);
    mm.joinMatchmaking(a);
    // socket/clientId diferentes, mesmo authUserId → não pode casar consigo nem duplicar.
    expect(() =>
      mm.joinMatchmaking({ ...a, socketId: "s1b", clientId: "c1b", joinedAt: Date.now() }),
    ).toThrowError(/already-in-queue/);
  });

  it("emite matchmakingStatus periodicamente enquanto aguarda", () => {
    mm.joinMatchmaking(player(1));
    deps.emitStatus.mockClear(); // ignora o status inicial do enqueue
    vi.advanceTimersByTime(2000 * 3 + 50);
    expect(deps.emitStatus).toHaveBeenCalledTimes(3);
  });
});
