import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock do cliente Supabase (server) — controlamos getUser por teste.
const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));
vi.mock("./db.js", () => ({
  getSupabase: () => ({ auth: { getUser: getUserMock } }),
}));

type Auth = typeof import("./auth.js");
let resolveAuthUser: Auth["resolveAuthUser"];

beforeEach(async () => {
  getUserMock.mockReset();
  vi.resetModules(); // zera o cache em memória do auth.ts
  ({ resolveAuthUser } = await import("./auth.js"));
});

describe("resolveAuthUser", () => {
  it("retorna o userId para um token válido", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    expect(await resolveAuthUser("tok-valido")).toBe("user-123");
    expect(getUserMock).toHaveBeenCalledWith("tok-valido");
  });

  it("retorna null para token inválido (erro do Supabase)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    expect(await resolveAuthUser("tok-ruim")).toBeNull();
  });

  it("retorna null para token vazio/undefined sem chamar o Supabase", async () => {
    expect(await resolveAuthUser(null)).toBeNull();
    expect(await resolveAuthUser(undefined)).toBeNull();
    expect(await resolveAuthUser("")).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("usa cache: o mesmo token não chama o Supabase duas vezes dentro do TTL", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-cache" } }, error: null });
    await resolveAuthUser("tok-cache");
    await resolveAuthUser("tok-cache");
    await resolveAuthUser("tok-cache");
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });

  it("cache expira após 5 minutos (chama o Supabase de novo)", async () => {
    vi.useFakeTimers();
    try {
      getUserMock.mockResolvedValue({ data: { user: { id: "u-ttl" } }, error: null });
      await resolveAuthUser("tok-ttl");
      expect(getUserMock).toHaveBeenCalledTimes(1);

      // dentro do TTL → ainda em cache
      vi.advanceTimersByTime(4 * 60 * 1000);
      await resolveAuthUser("tok-ttl");
      expect(getUserMock).toHaveBeenCalledTimes(1);

      // passou de 5 min → cache expira
      vi.advanceTimersByTime(61 * 1000);
      await resolveAuthUser("tok-ttl");
      expect(getUserMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("erro de rede (getUser lança) retorna null e NÃO cacheia (tenta de novo na próxima)", async () => {
    getUserMock.mockRejectedValueOnce(new Error("network down"));
    expect(await resolveAuthUser("tok-flaky")).toBeNull();
    // não cacheou o erro de rede → próxima chamada tenta de novo
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "u-ok" } }, error: null });
    expect(await resolveAuthUser("tok-flaky")).toBe("u-ok");
    expect(getUserMock).toHaveBeenCalledTimes(2);
  });
});
