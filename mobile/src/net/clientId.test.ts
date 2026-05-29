// Mock do AsyncStorage (RN) — controlamos read/write por teste.
// Nome com prefixo "mock" é exigido pela hoist do jest.mock.
const mockStore = { getItem: jest.fn(), setItem: jest.fn() };
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: mockStore,
}));

beforeEach(() => {
  jest.resetModules(); // zera o `cached` interno do clientId.ts
  mockStore.getItem.mockReset();
  mockStore.setItem.mockReset();
});

describe("clientId (mobile)", () => {
  it("initClientId devolve o valor persistido quando existe", async () => {
    mockStore.getItem.mockResolvedValue("id-persistido");
    const { initClientId } = require("./clientId");
    expect(await initClientId()).toBe("id-persistido");
    expect(mockStore.setItem).not.toHaveBeenCalled();
  });

  it("initClientId gera e persiste um novo id quando não há nada salvo", async () => {
    mockStore.getItem.mockResolvedValue(null);
    mockStore.setItem.mockResolvedValue(undefined);
    const { initClientId } = require("./clientId");
    const id = await initClientId();
    expect(id).toBeTruthy();
    expect(mockStore.setItem).toHaveBeenCalledWith("barreira.clientId", id);
  });

  it("getClientId devolve o id em cache após o init", async () => {
    mockStore.getItem.mockResolvedValue("id-cache");
    const mod = require("./clientId");
    await mod.initClientId();
    expect(mod.getClientId()).toBe("id-cache");
  });

  it("getClientId antes do init gera um valor de defesa (não crasha)", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { getClientId } = require("./clientId");
    expect(getClientId()).toBeTruthy();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("se o AsyncStorage falhar na leitura, ainda gera um id em memória", async () => {
    mockStore.getItem.mockRejectedValue(new Error("storage boom"));
    mockStore.setItem.mockResolvedValue(undefined);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { initClientId } = require("./clientId");
    const id = await initClientId();
    expect(id).toBeTruthy();
    warn.mockRestore();
  });
});
