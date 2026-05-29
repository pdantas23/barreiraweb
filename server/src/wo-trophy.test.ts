import { describe, it, expect, beforeEach, vi } from "vitest";

// Testa a GUARDA do callback de W.O. no index.ts: ele só pode premiar se a
// partida ainda estava em andamento (winner === null). Importamos o index real
// (que registra o callback na lobby real) com as dependências pesadas mockadas,
// e disparamos o timeout pela própria lobby.

const mocks = vi.hoisted(() => ({
  toEmit: vi.fn(),
  awardCasualTrophy: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn(),
  fakeIo: null as unknown,
}));
mocks.fakeIo = { on: vi.fn(), emit: vi.fn(), to: vi.fn(() => ({ emit: mocks.toEmit })) };

vi.mock("node:http", () => ({ createServer: () => ({ listen: mocks.listen }) }));
vi.mock("socket.io", () => ({ Server: vi.fn(() => mocks.fakeIo) }));
vi.mock("./trophies.js", () => ({ awardCasualTrophy: mocks.awardCasualTrophy }));
vi.mock("./botManager.js", () => ({
  startBotManager: vi.fn(),
  maybeBotRequestRematch: vi.fn(),
  maybeScheduleBotMove: vi.fn(),
  scheduleBotRescue: vi.fn(),
  setOnBotRescueStarted: vi.fn(),
}));

type Lobby = typeof import("./lobby.js");
let lobby: Lobby;

beforeEach(async () => {
  mocks.awardCasualTrophy.mockClear();
  vi.resetModules();
  await import("./index.js"); // side-effect: registra onPlayerTimeout na lobby
  lobby = await import("./lobby.js");
});

const startMatch = (winnerAlreadySet: boolean) => {
  const room = lobby.createRoom({
    hostSocketId: "s-host",
    hostClientId: "c-host",
    hostAuthUserId: "u-winner",
    hostName: "H",
    color: "cyan",
    isPrivate: false,
  });
  lobby.joinRoom({
    socketId: "s-guest",
    clientId: "c-guest",
    authUserId: "u-loser",
    playerName: "G",
    code: room.code,
  });
  const live = lobby.getRoomBySocket("s-host")!;
  if (winnerAlreadySet) live.gameState = { ...live.gameState!, winner: 1 };
  return live;
};

describe("W.O. — guarda contra troféu em dobro (CRÍTICO 1)", () => {
  it("premia o vencedor no W.O. de uma partida em andamento", () => {
    vi.useFakeTimers();
    try {
      startMatch(false);
      lobby.markDisconnected("s-guest");
      vi.advanceTimersByTime(lobby.getDisconnectTimeoutMs() + 10);
      expect(mocks.awardCasualTrophy).toHaveBeenCalledTimes(1);
      expect(mocks.awardCasualTrophy).toHaveBeenCalledWith("u-winner", 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("NÃO premia de novo quando a partida já tinha terminado (winner != null)", () => {
    vi.useFakeTimers();
    try {
      startMatch(true); // jogo já decidido antes do timer disparar
      lobby.markDisconnected("s-guest");
      vi.advanceTimersByTime(lobby.getDisconnectTimeoutMs() + 10);
      expect(mocks.awardCasualTrophy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
