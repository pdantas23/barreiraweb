import { errorInfo } from "./errors";

describe("errorInfo (mobile)", () => {
  it("mapeia códigos conhecidos para título + mensagem", () => {
    expect(errorInfo("room-not-found").title).toMatch(/não encontrada/i);
    expect(errorInfo("room-full").title).toMatch(/cheia/i);
    expect(errorInfo("wrong-password").title).toMatch(/senha/i);
    expect(errorInfo("already-in-room").title).toMatch(/sala/i);
  });

  it("internal-error vira 'Sem conexão'", () => {
    expect(errorInfo("internal-error").title).toMatch(/sem conexão/i);
  });

  it("código desconhecido cai no default", () => {
    const info = errorInfo("xpto-inexistente");
    expect(info.title).toBeTruthy();
    expect(info.message).toBeTruthy();
  });

  it("sempre retorna title e message não-vazios", () => {
    for (const code of ["room-not-found", "room-full", "already-in-room", "not-in-room", "invalid-payload"]) {
      const info = errorInfo(code);
      expect(info.title.length).toBeGreaterThan(0);
      expect(info.message.length).toBeGreaterThan(0);
    }
  });
});
