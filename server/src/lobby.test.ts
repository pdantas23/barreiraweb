import { describe, it, expect, beforeEach, vi } from "vitest";

// lobby.ts mantém estado global em Maps de módulo. Pra cada teste ser
// independente, recarregamos o módulo (vi.resetModules) e re-importamos —
// assim cada teste começa com lobby vazio.
type Lobby = typeof import("./lobby.js");
let lobby: Lobby;

beforeEach(async () => {
  vi.resetModules();
  lobby = await import("./lobby.js");
});

// Helpers pra criar entradas com defaults.
const createInput = (over: Partial<Parameters<Lobby["createRoom"]>[0]> = {}) => ({
  hostSocketId: "s-host",
  hostClientId: "c-host",
  hostAuthUserId: null,
  hostName: "Host",
  color: "cyan" as const,
  isPrivate: false,
  ...over,
});

const joinInput = (over: Partial<Parameters<Lobby["joinRoom"]>[0]> = {}) => ({
  socketId: "s-guest",
  clientId: "c-guest",
  authUserId: null,
  playerName: "Guest",
  code: "XXXXXX",
  ...over,
});

describe("createRoom", () => {
  it("cria sala com authUserId quando logado", () => {
    const room = lobby.createRoom(createInput({ hostAuthUserId: "u1" }));
    expect(room.status).toBe("waiting");
    expect(room.code).toHaveLength(6);
    expect(room.players).toHaveLength(1);
    expect(room.players[0].authUserId).toBe("u1");
    expect(room.players[0].enginePlayer).toBe(1);
    expect(room.gameState).toBeNull();
  });

  it("cria sala anônima (authUserId null)", () => {
    const room = lobby.createRoom(createInput({ hostAuthUserId: null }));
    expect(room.players[0].authUserId).toBeNull();
  });

  it("sala privada recebe senha gerada", () => {
    const room = lobby.createRoom(createInput({ isPrivate: true }));
    expect(room.isPrivate).toBe(true);
    expect(room.password).toHaveLength(6);
  });
});

describe("joinRoom", () => {
  it("entrada normal inicia a partida (status playing, 2 players, gameState)", () => {
    const room = lobby.createRoom(createInput());
    const joined = lobby.joinRoom(joinInput({ code: room.code }));
    expect(joined.status).toBe("playing");
    expect(joined.players).toHaveLength(2);
    expect(joined.players[1].enginePlayer).toBe(2);
    expect(joined.gameState).not.toBeNull();
    expect(joined.gameState?.p1).toBe(76);
    expect(joined.gameState?.p2).toBe(4);
  });

  it("self-match: mesma conta nos dois lados é bloqueada", () => {
    const room = lobby.createRoom(createInput({ hostAuthUserId: "same" }));
    expect(() =>
      lobby.joinRoom(joinInput({ code: room.code, authUserId: "same" })),
    ).toThrowError(/self-match/);
  });

  it("sala cheia rejeita o 3º jogador", () => {
    const room = lobby.createRoom(createInput());
    lobby.joinRoom(joinInput({ code: room.code }));
    expect(() =>
      lobby.joinRoom(joinInput({ code: room.code, socketId: "s3", clientId: "c3" })),
    ).toThrowError(/room-full/);
  });

  it("sala inexistente → room-not-found", () => {
    expect(() => lobby.joinRoom(joinInput({ code: "NOPE12" }))).toThrowError(/room-not-found/);
  });

  it("senha errada em sala privada → wrong-password", () => {
    const room = lobby.createRoom(createInput({ isPrivate: true }));
    expect(() =>
      lobby.joinRoom(joinInput({ code: room.code, password: "ERRADA" })),
    ).toThrowError(/wrong-password/);
  });

  it("cliente já numa partida ativa não entra em outra (already-in-room)", () => {
    const roomA = lobby.createRoom(createInput({ hostSocketId: "sA", hostClientId: "cA" }));
    lobby.joinRoom(joinInput({ code: roomA.code, socketId: "sB", clientId: "cB" })); // A vira playing
    const roomC = lobby.createRoom(createInput({ hostSocketId: "sC", hostClientId: "cC" }));
    // cB (preso na partida A) tenta entrar na sala C
    expect(() =>
      lobby.joinRoom(joinInput({ code: roomC.code, socketId: "sB2", clientId: "cB" })),
    ).toThrowError(/already-in-room/);
  });
});

describe("leaveRoom", () => {
  it("host sai de sala em espera → sala é deletada", () => {
    const room = lobby.createRoom(createInput());
    const result = lobby.leaveRoom("s-host");
    expect(result).toBeNull();
    expect(lobby.getAllRooms().has(room.code)).toBe(false);
  });

  it("jogador sai durante a partida → sala vira finished com o que ficou", () => {
    const room = lobby.createRoom(createInput());
    lobby.joinRoom(joinInput({ code: room.code }));
    const after = lobby.leaveRoom("s-guest");
    expect(after).not.toBeNull();
    expect(after?.status).toBe("finished");
    expect(after?.players).toHaveLength(1);
    expect(after?.players[0].socketId).toBe("s-host");
    expect(after?.gameState).not.toBeNull(); // estado preservado pro index premiar o vencedor
  });

  it("socket fora de sala → null", () => {
    expect(lobby.leaveRoom("desconhecido")).toBeNull();
  });
});

describe("listPublicRooms", () => {
  it("esconde a sala do próprio usuário logado", () => {
    lobby.createRoom(createInput({ hostAuthUserId: "u1" }));
    expect(lobby.listPublicRooms("u1")).toHaveLength(0);
    expect(lobby.listPublicRooms("outro")).toHaveLength(1);
    expect(lobby.listPublicRooms(null)).toHaveLength(1);
  });

  it("só lista salas em espera (não as que já estão jogando)", () => {
    const room = lobby.createRoom(createInput());
    expect(lobby.listPublicRooms(null)).toHaveLength(1);
    lobby.joinRoom(joinInput({ code: room.code })); // vira playing
    expect(lobby.listPublicRooms(null)).toHaveLength(0);
  });
});

describe("attemptReanchor", () => {
  it("atualiza authUserId do player se ele tinha entrado anônimo", () => {
    const room = lobby.createRoom(createInput({ hostClientId: "c-host", hostAuthUserId: null }));
    lobby.joinRoom(joinInput({ code: room.code }));
    lobby.markDisconnected("s-host");
    const anchor = lobby.attemptReanchor("c-host", "s-host-novo", "u-recuperado");
    expect(anchor).not.toBeNull();
    expect(anchor?.player.authUserId).toBe("u-recuperado");
    expect(anchor?.player.socketId).toBe("s-host-novo");
    // o novo socket agora aponta pra sala
    expect(lobby.getRoomBySocket("s-host-novo")?.code).toBe(room.code);
  });

  it("player logado: permite reanchor com o MESMO authUserId (preserva identidade)", () => {
    const room = lobby.createRoom(createInput({ hostClientId: "c-host", hostAuthUserId: "u-original" }));
    lobby.joinRoom(joinInput({ code: room.code }));
    lobby.markDisconnected("s-host");
    const anchor = lobby.attemptReanchor("c-host", "s-novo", "u-original");
    expect(anchor).not.toBeNull();
    expect(anchor?.player.authUserId).toBe("u-original");
    expect(anchor?.player.socketId).toBe("s-novo");
  });

  it("player logado: REJEITA reanchor com authUserId diferente (anti-sequestro)", () => {
    const room = lobby.createRoom(createInput({ hostClientId: "c-host", hostAuthUserId: "u-original" }));
    lobby.joinRoom(joinInput({ code: room.code }));
    lobby.markDisconnected("s-host");
    const anchor = lobby.attemptReanchor("c-host", "s-atacante", "u-atacante");
    expect(anchor).toBeNull();
    // o slot NÃO foi movido pro socket do atacante
    expect(lobby.getRoomBySocket("s-atacante")).toBeNull();
  });

  it("player logado: REJEITA reanchor sem token no socket novo (authUserId null)", () => {
    const room = lobby.createRoom(createInput({ hostClientId: "c-host", hostAuthUserId: "u-original" }));
    lobby.joinRoom(joinInput({ code: room.code }));
    lobby.markDisconnected("s-host");
    const anchor = lobby.attemptReanchor("c-host", "s-atacante", null);
    expect(anchor).toBeNull();
  });

  it("player anônimo: reanchor segue só com clientId (sem exigir token)", () => {
    const room = lobby.createRoom(createInput({ hostClientId: "c-anon", hostAuthUserId: null }));
    lobby.joinRoom(joinInput({ code: room.code }));
    lobby.markDisconnected("s-host");
    const anchor = lobby.attemptReanchor("c-anon", "s-novo", null);
    expect(anchor).not.toBeNull();
    expect(anchor?.player.socketId).toBe("s-novo");
  });

  it("clientId desconhecido → null", () => {
    expect(lobby.attemptReanchor("fantasma", "s-x", "u1")).toBeNull();
  });
});

describe("markDisconnected + finalizeTimeout (W.O.)", () => {
  it("após o timeout, dispara onPlayerTimeout com quem ficou", () => {
    vi.useFakeTimers();
    try {
      const onTimeout = vi.fn();
      lobby.setOnPlayerTimeout(onTimeout);
      const room = lobby.createRoom(createInput({ hostAuthUserId: "winner" }));
      lobby.joinRoom(joinInput({ code: room.code, authUserId: "loser" }));

      lobby.markDisconnected("s-guest"); // guest cai
      expect(onTimeout).not.toHaveBeenCalled();

      vi.advanceTimersByTime(lobby.getDisconnectTimeoutMs() + 10);

      expect(onTimeout).toHaveBeenCalledTimes(1);
      const [, roomArg, remaining] = onTimeout.mock.calls[0];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].authUserId).toBe("winner");
      expect(roomArg.status).toBe("finished");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reanchor antes do timeout cancela o W.O.", () => {
    vi.useFakeTimers();
    try {
      const onTimeout = vi.fn();
      lobby.setOnPlayerTimeout(onTimeout);
      const room = lobby.createRoom(createInput());
      lobby.joinRoom(joinInput({ code: room.code }));
      lobby.markDisconnected("s-guest");
      lobby.attemptReanchor("c-guest", "s-guest-novo");
      vi.advanceTimersByTime(lobby.getDisconnectTimeoutMs() + 10);
      expect(onTimeout).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("rematch", () => {
  const setupFinishedGame = () => {
    const room = lobby.createRoom(createInput({ hostAuthUserId: "u-host" }));
    lobby.joinRoom(joinInput({ code: room.code, authUserId: "u-guest" }));
    // simula fim de jogo
    const live = lobby.getRoomBySocket("s-host")!;
    live.status = "finished";
    live.gameState = { ...live.gameState!, winner: 1 };
    return live;
  };

  it("aceitar revanche reseta o gameState e preserva os authUserIds", () => {
    const room = setupFinishedGame();
    const beforeAuth = room.players.map((p) => p.authUserId);

    lobby.requestRematch("s-host");
    const after = lobby.respondRematch("s-guest", true);

    expect(after.status).toBe("playing");
    expect(after.gameState?.winner).toBeNull();
    expect(after.gameState?.p1).toBe(76);
    expect(after.gameState?.p2).toBe(4);
    expect(after.players.map((p) => p.authUserId)).toEqual(beforeAuth);
    expect(after.rematch).toBeNull();
  });

  it("requestRematch falha se a partida não acabou", () => {
    const room = lobby.createRoom(createInput());
    lobby.joinRoom(joinInput({ code: room.code })); // status playing
    expect(() => lobby.requestRematch("s-host")).toThrowError(/game-not-over/);
  });

  it("recusar revanche não reseta o jogo", () => {
    const room = setupFinishedGame();
    lobby.requestRematch("s-host");
    const after = lobby.respondRematch("s-guest", false);
    expect(after.status).toBe("finished");
    expect(after.rematch).toBeNull();
  });
});

describe("salas de bot (lobby-level)", () => {
  it("createBotHostRoom cria sala pública com 1 bot", () => {
    const room = lobby.createBotHostRoom({ hostName: "anonimo1234", color: "cyan" });
    expect(room.status).toBe("waiting");
    expect(room.isPrivate).toBe(false);
    expect(room.players).toHaveLength(1);
    expect(room.players[0].isBot).toBe(true);
    expect(room.players[0].authUserId).toBeNull();
  });

  it("addBotGuest entra numa sala em espera e inicia a partida", () => {
    const room = lobby.createRoom(createInput());
    const updated = lobby.addBotGuest({ code: room.code, botName: "anonimo9999" });
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("playing");
    expect(updated?.players).toHaveLength(2);
    expect(updated?.players[1].isBot).toBe(true);
    expect(updated?.gameState).not.toBeNull();
  });

  it("addBotGuest NÃO entra em sala já cheia/fechada", () => {
    const room = lobby.createRoom(createInput());
    lobby.joinRoom(joinInput({ code: room.code })); // cheia + playing
    expect(lobby.addBotGuest({ code: room.code, botName: "x" })).toBeNull();
  });

  it("addBotGuest em sala inexistente → null", () => {
    expect(lobby.addBotGuest({ code: "NOPE12", botName: "x" })).toBeNull();
  });
});

describe("relógio autoritativo (reportTimeout backend)", () => {
  it("initGameClock zera o uso e ancora no fim do countdown", () => {
    const room = lobby.createRoom(createInput());
    room.countdownEndsAt = 1000;
    lobby.initGameClock(room);
    expect(room.timeUsedMs).toEqual({ 1: 0, 2: 0 });
    expect(room.turnStartedAt).toBe(1000);
  });

  it("chargeTurnTime debita o turno do jogador e reinicia o cronômetro", () => {
    const room = lobby.createRoom(createInput());
    room.countdownEndsAt = 0;
    lobby.initGameClock(room); // turnStartedAt = 0
    lobby.chargeTurnTime(room, 1, 5000); // P1 gastou 5s
    expect(room.timeUsedMs[1]).toBe(5000);
    expect(room.turnStartedAt).toBe(5000);
    lobby.chargeTurnTime(room, 2, 8000); // P2 gastou 3s
    expect(room.timeUsedMs[2]).toBe(3000);
  });

  it("turnTimeUsedMs soma o turno em andamento só pra quem está jogando", () => {
    const room = lobby.createRoom(createInput());
    lobby.joinRoom(joinInput({ code: room.code }));
    const live = lobby.getRoomBySocket("s-host")!;
    live.timeUsedMs = { 1: 2000, 2: 4000 };
    live.turnStartedAt = 10000;
    live.gameState = { ...live.gameState!, turn: 1 };
    // P1 é o da vez: 2000 acumulado + (12000-10000) em andamento
    expect(lobby.turnTimeUsedMs(live, 1, 12000)).toBe(4000);
    // P2 não é o da vez: só o acumulado
    expect(lobby.turnTimeUsedMs(live, 2, 12000)).toBe(4000);
  });
});
