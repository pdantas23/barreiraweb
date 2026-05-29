import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { initialState, serializeState, applyMove, type GameStartPayload } from "@barreira/shared";

// ---- Mocks de todas as dependências externas do hook ----

// Socket: emissor de eventos controlável.
const sockH = vi.hoisted(() => {
  const handlers = new Map<string, Array<(p: unknown) => void>>();
  return {
    handlers,
    socket: {
      on: (e: string, h: (p: unknown) => void) => {
        const arr = handlers.get(e) ?? [];
        arr.push(h);
        handlers.set(e, arr);
      },
      off: (e: string, h: (p: unknown) => void) => {
        handlers.set(e, (handlers.get(e) ?? []).filter((x) => x !== h));
      },
    },
    lastGameStart: { value: null as GameStartPayload | null },
    emit(e: string, p: unknown) {
      (handlers.get(e) ?? []).forEach((h) => h(p));
    },
  };
});

vi.mock("../net/socket", () => ({
  getSocket: () => sockH.socket,
  getLastGameStart: () => sockH.lastGameStart.value,
  clearLastGameStart: vi.fn(),
}));

const apiH = vi.hoisted(() => ({
  sendMove: vi.fn().mockResolvedValue({ ok: true }),
  leaveRoom: vi.fn().mockResolvedValue({ ok: true }),
  reportTimeout: vi.fn().mockResolvedValue({ ok: true }),
  requestRematch: vi.fn().mockResolvedValue({ ok: true }),
  respondRematch: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../net/api", () => ({
  sendMove: apiH.sendMove,
  leaveRoom: apiH.leaveRoom,
  reportTimeout: apiH.reportTimeout,
  requestRematch: apiH.requestRematch,
  respondRematch: apiH.respondRematch,
}));

const authH = vi.hoisted(() => ({ refreshTrofeus: vi.fn() }));
vi.mock("../state/auth", () => ({ useAuth: () => ({ refreshTrofeus: authH.refreshTrofeus }) }));
vi.mock("../state/profile", () => ({ usePlayerName: () => "Eu" }));
vi.mock("../state/dragOverlay", () => ({
  useDragOverlay: () => ({
    dragX: { current: 0 },
    dragY: { current: 0 },
    lastInter: { current: null },
    show: vi.fn(),
    hide: vi.fn(),
  }),
}));

// Timer: controlamos timedOutPlayer por um holder mutável.
const timerH = vi.hoisted(() => ({ timedOutPlayer: null as 1 | 2 | null }));
vi.mock("../components/GameTimer", () => ({
  useGameTimers: () => ({
    p1TimeMs: 300000,
    p2TimeMs: 300000,
    timedOutPlayer: timerH.timedOutPlayer,
    resetTimers: vi.fn(),
  }),
}));

vi.mock("./useButtonSound", () => ({ useButtonSound: vi.fn(), playButtonSound: vi.fn() }));
vi.mock("./usePieceSound", () => ({ usePieceMoveSound: vi.fn() }));
vi.mock("./useWallSound", () => ({ useWallPlaceSound: vi.fn() }));
vi.mock("./useResponsiveBoard", () => ({ useResponsiveBoard: () => ({ cellSize: 40, gap: 4, padding: 8 }) }));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams("role=guest&code=ABCDEF"), vi.fn()],
}));

import { useOnlineGame } from "./useOnlineGame";

const gameStartPayload = (yourEnginePlayer: 1 | 2 = 1): GameStartPayload => ({
  state: serializeState(initialState(1)),
  yourEnginePlayer,
  yourColor: "cyan",
  opponentName: "Oponente",
  opponentColor: "red",
  countdownStartsAt: Date.now(),
  timeTotalMs: 300000,
});

beforeEach(() => {
  sockH.handlers.clear();
  sockH.lastGameStart.value = null;
  timerH.timedOutPlayer = null;
  apiH.sendMove.mockClear();
  apiH.reportTimeout.mockClear();
  authH.refreshTrofeus.mockClear();
});

describe("useOnlineGame", () => {
  it("estado inicial: não está pronto antes de receber gameStart", () => {
    const { result } = renderHook(() => useOnlineGame());
    expect(result.current.ready).toBe(false);
    expect(result.current.code).toBe("ABCDEF");
    expect(result.current.isHost).toBe(false);
  });

  it("gameStart deixa a partida pronta e define myPlayer", () => {
    const { result } = renderHook(() => useOnlineGame());
    act(() => sockH.emit("gameStart", gameStartPayload(1)));
    expect(result.current.ready).toBe(true);
    expect(result.current.myPlayer).toBe(1);
    expect(result.current.opponentName).toBe("Oponente");
    expect(result.current.state.p1).toBe(76);
  });

  it("stateUpdate atualiza o estado do tabuleiro", () => {
    const { result } = renderHook(() => useOnlineGame());
    act(() => sockH.emit("gameStart", gameStartPayload(1)));

    const moved = applyMove(initialState(1), 1, { kind: "piece", to: 67 });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;

    act(() => sockH.emit("stateUpdate", { state: serializeState(moved.state), move: { kind: "piece", to: 67 } }));
    expect(result.current.state.p1).toBe(67);
  });

  it("gameOver com winner === eu chama refreshTrofeus", () => {
    const { result } = renderHook(() => useOnlineGame());
    act(() => sockH.emit("gameStart", gameStartPayload(1)));
    act(() => sockH.emit("gameOver", { winner: 1, reason: "goal" }));
    expect(authH.refreshTrofeus).toHaveBeenCalledTimes(1);
    void result.current;
  });

  it("gameOver com winner === oponente NÃO chama refreshTrofeus", () => {
    renderHook(() => useOnlineGame());
    act(() => sockH.emit("gameStart", gameStartPayload(1)));
    act(() => sockH.emit("gameOver", { winner: 2, reason: "goal" }));
    expect(authH.refreshTrofeus).not.toHaveBeenCalled();
  });

  it("quando o relógio zera, chama reportTimeout e marca o vencedor local", () => {
    const { result, rerender } = renderHook(() => useOnlineGame());
    act(() => sockH.emit("gameStart", gameStartPayload(1)));

    // P1 (eu) estoura o tempo → vencedor local = 2, e avisa o servidor.
    timerH.timedOutPlayer = 1;
    act(() => rerender());

    expect(apiH.reportTimeout).toHaveBeenCalledTimes(1);
    expect(result.current.state.winner).toBe(2);
  });
});
