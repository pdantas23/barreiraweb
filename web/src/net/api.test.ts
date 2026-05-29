import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// Isola a camada de socket — safeRpc depende de whenConnected + connectSocket.
vi.mock("./socket", () => ({
  connectSocket: vi.fn(),
  whenConnected: vi.fn(),
}));

import { connectSocket, whenConnected } from "./socket";
import { listRooms, createRoom } from "./api";

const mockConnect = connectSocket as unknown as Mock;
const mockWhenConnected = whenConnected as unknown as Mock;

beforeEach(() => {
  mockConnect.mockReset();
  mockWhenConnected.mockReset();
});

describe("safeRpc (via listRooms/createRoom)", () => {
  it("retorna o resultado do servidor quando o socket está conectado", async () => {
    mockWhenConnected.mockResolvedValue(undefined);
    const emitWithAck = vi.fn().mockResolvedValue({ ok: true, data: { rooms: [] } });
    mockConnect.mockReturnValue({ connected: true, emitWithAck });

    const res = await listRooms();

    expect(res).toEqual({ ok: true, data: { rooms: [] } });
    expect(emitWithAck).toHaveBeenCalledWith("listRooms", {});
  });

  it("retorna internal-error / 'Sem conexão' quando o socket nunca conecta", async () => {
    mockWhenConnected.mockRejectedValue(new Error("connect-timeout"));
    const emitWithAck = vi.fn();
    mockConnect.mockReturnValue({ connected: false, emitWithAck });

    const res = await listRooms();

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("internal-error");
      expect(res.message).toMatch(/Sem conexão/i);
    }
    // a RPC nem chega a ser enviada — o erro vem do whenConnected, não do servidor
    expect(emitWithAck).not.toHaveBeenCalled();
  });

  it("não dispara erro preventivamente: só falha após whenConnected realmente rejeitar", async () => {
    // whenConnected pendente → a promise de createRoom não resolve com erro
    // enquanto a conexão não falha (sem falso 'Sem conexão' no cold start).
    let rejectConn!: (e: Error) => void;
    mockWhenConnected.mockReturnValue(new Promise((_, rej) => { rejectConn = rej; }));
    mockConnect.mockReturnValue({ connected: false, emitWithAck: vi.fn() });

    const p = createRoom({ hostName: "x", color: "random", isPrivate: false });
    let settled = false;
    void p.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false); // ainda não falhou

    rejectConn(new Error("connect-timeout"));
    const res = await p;
    expect(res.ok).toBe(false);
  });
});
