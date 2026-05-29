// Mesma cobertura de safeRpc da web: sucesso quando conectado, erro tipado
// quando não conecta (sem disparar a RPC).
jest.mock("./socket", () => ({
  connectSocket: jest.fn(),
  whenConnected: jest.fn(),
}));

import { connectSocket, whenConnected } from "./socket";
import { listRooms, reportTimeout } from "./api";

const mockConnect = connectSocket as jest.Mock;
const mockWhenConnected = whenConnected as jest.Mock;

beforeEach(() => {
  // Fake timers: o withTimeout do safeRpc agenda um setTimeout(8s) que, no
  // caminho feliz, ficaria pendurado (open handle). Com timers fake ele some
  // ao restaurar, sem warning de "worker failed to exit".
  jest.useFakeTimers();
  mockConnect.mockReset();
  mockWhenConnected.mockReset();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("safeRpc (mobile, via listRooms)", () => {
  it("retorna o resultado do servidor quando conectado", async () => {
    mockWhenConnected.mockResolvedValue(undefined);
    const emitWithAck = jest.fn().mockResolvedValue({ ok: true, data: { rooms: [] } });
    mockConnect.mockReturnValue({ connected: true, emitWithAck });

    const res = await listRooms();
    expect(res).toEqual({ ok: true, data: { rooms: [] } });
    expect(emitWithAck).toHaveBeenCalledWith("listRooms", {});
  });

  it("retorna internal-error / 'Sem conexão' quando o socket nunca conecta", async () => {
    mockWhenConnected.mockRejectedValue(new Error("connect-timeout"));
    const emitWithAck = jest.fn();
    mockConnect.mockReturnValue({ connected: false, emitWithAck });

    const res = await listRooms();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("internal-error");
      expect(res.message).toMatch(/Sem conexão/i);
    }
    expect(emitWithAck).not.toHaveBeenCalled();
  });

  it("reportTimeout emite o evento reportTimeout (CRÍTICO 3)", async () => {
    mockWhenConnected.mockResolvedValue(undefined);
    const emitWithAck = jest.fn().mockResolvedValue({ ok: true, data: null });
    mockConnect.mockReturnValue({ connected: true, emitWithAck });

    await reportTimeout();
    expect(emitWithAck).toHaveBeenCalledWith("reportTimeout", {});
  });
});
