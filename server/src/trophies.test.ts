import { describe, it, expect, beforeEach, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock("./db.js", () => ({
  getSupabase: () => ({ rpc: rpcMock }),
}));

type Trophies = typeof import("./trophies.js");
let awardCasualTrophy: Trophies["awardCasualTrophy"];

beforeEach(async () => {
  rpcMock.mockReset();
  vi.resetModules();
  ({ awardCasualTrophy } = await import("./trophies.js"));
});

describe("awardCasualTrophy", () => {
  it("chama o RPC increment_trofeus_casual com user e delta corretos", async () => {
    rpcMock.mockResolvedValue({ data: 5, error: null });
    await awardCasualTrophy("user-abc", 1);
    expect(rpcMock).toHaveBeenCalledWith("increment_trofeus_casual", {
      p_user_id: "user-abc",
      p_delta: 1,
    });
  });

  it("usa delta=1 por padrão", async () => {
    rpcMock.mockResolvedValue({ data: 1, error: null });
    await awardCasualTrophy("user-abc");
    expect(rpcMock).toHaveBeenCalledWith("increment_trofeus_casual", {
      p_user_id: "user-abc",
      p_delta: 1,
    });
  });

  it("falha silenciosamente se o Supabase cair (NÃO lança)", async () => {
    rpcMock.mockRejectedValue(new Error("supabase offline"));
    await expect(awardCasualTrophy("user-abc", 1)).resolves.toBeUndefined();
  });

  it("não lança quando o RPC devolve erro", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc boom" } });
    await expect(awardCasualTrophy("user-abc", 1)).resolves.toBeUndefined();
  });

  it("não lança quando o user não tem linha em profiles (data null)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await expect(awardCasualTrophy("user-sem-profile", 1)).resolves.toBeUndefined();
  });
});
