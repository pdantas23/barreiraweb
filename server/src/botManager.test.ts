import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Testa o reaper de salas de bot órfãs (IMPORTANTE 1). Roda o botManager real
// com a lobby real e timers fake. BOT_MIN_WAITING=0 evita que o scan spawne
// salas-decoy durante o teste.

type Lobby = typeof import("./lobby.js");
type BotMgr = typeof import("./botManager.js");
let lobby: Lobby;
let botManager: BotMgr;

beforeEach(async () => {
  process.env.BOT_MIN_WAITING = "0";
  vi.resetModules();
  botManager = await import("./botManager.js");
  lobby = await import("./lobby.js");
});

afterEach(() => {
  vi.useRealTimers();
});

const fakeIo = { on: vi.fn(), emit: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })) } as never;

describe("botManager — reaper de salas órfãs (IMPORTANTE 1)", () => {
  it("deleta a sala que ficou só com bot depois que o humano sai", () => {
    vi.useFakeTimers();
    botManager.startBotManager(fakeIo);

    const room = lobby.createBotHostRoom({ hostName: "anonimo1111", color: "cyan" });
    lobby.joinRoom({
      socketId: "s-h",
      clientId: "c-h",
      authUserId: null,
      playerName: "Humano",
      code: room.code,
    });
    lobby.leaveRoom("s-h"); // humano sai → sala fica [bot], finished

    const code = room.code;
    expect(lobby.getAllRooms().get(code)?.players.every((p) => p.isBot)).toBe(true);

    // scan (4s) detecta a órfã e agenda a saída do bot. O delay agora cobre a
    // janela de revanche (REMATCH_TIMEOUT_MS + 3-6s) pra o humano poder pedir
    // revanche — então avançamos o suficiente pra o leave disparar.
    vi.advanceTimersByTime(4000 + 15000 + 6000 + 1000);

    expect(lobby.getAllRooms().has(code)).toBe(false);
  });

  it("NÃO deleta sala de bot em espera (decoy intencional do lobby)", () => {
    vi.useFakeTimers();
    botManager.startBotManager(fakeIo);

    const room = lobby.createBotHostRoom({ hostName: "anonimo2222", color: "red" });
    expect(room.status).toBe("waiting");

    vi.advanceTimersByTime(20000); // vários scans

    expect(lobby.getAllRooms().has(room.code)).toBe(true);
  });

  it("após o fim da partida, o bot FICA durante a janela de revanche (não sai em 3-6s)", () => {
    vi.useFakeTimers();
    botManager.startBotManager(fakeIo);

    const room = lobby.createBotHostRoom({ hostName: "anonimo3333", color: "cyan" });
    lobby.joinRoom({
      socketId: "s-h",
      clientId: "c-h",
      authUserId: null,
      playerName: "Humano",
      code: room.code,
    });
    // Simula o fim por vitória: maybeScheduleBotMove agenda a saída do bot
    // quando há vencedor (precisa de status "playing" pra não retornar cedo);
    // depois o status vira "finished", como no fluxo real pós-vitória.
    const live = lobby.getRoomBySocket("s-h")!;
    live.gameState = { ...live.gameState!, winner: 2 };
    botManager.maybeScheduleBotMove(live);
    live.status = "finished";

    // Dentro da janela de revanche o bot continua na sala (antes saía em 3-6s).
    vi.advanceTimersByTime(8000);
    expect(lobby.getRoomBySocket("s-h")?.players.some((p) => p.isBot)).toBe(true);

    // Passada a janela de revanche, o bot sai (o humano permanece na sala).
    vi.advanceTimersByTime(15000 + 6000 + 1000);
    expect(lobby.getRoomBySocket("s-h")?.players.some((p) => p.isBot)).toBe(false);
  });
});
