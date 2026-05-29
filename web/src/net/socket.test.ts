import { describe, it, expect } from "vitest";
import { getHandshakeToken } from "./socket";

describe("socket — getHandshakeToken", () => {
  it("retorna undefined antes da primeira conexão (handshake nunca rodou)", () => {
    // O módulo acabou de carregar e nenhum socket conectou ainda.
    expect(getHandshakeToken()).toBeUndefined();
  });
});
