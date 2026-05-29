import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act, waitFor } from "@testing-library/react";

// Mocks do socket e do supabase — capturamos o callback de onAuthStateChange
// pra disparar eventos de auth e checar a decisão de reconectar (Correção 1).
const h = vi.hoisted(() => ({
  reconnectSocket: vi.fn(),
  getHandshakeToken: vi.fn(),
  getSession: vi.fn(),
  authCb: { fn: null as null | ((event: string, session: unknown) => void) },
}));

vi.mock("../net/socket", () => ({
  reconnectSocket: h.reconnectSocket,
  getHandshakeToken: h.getHandshakeToken,
}));

vi.mock("../net/supabase", () => ({
  supabase: {
    auth: {
      getSession: h.getSession,
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        h.authCb.fn = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  },
}));

import { AuthProvider } from "./auth";

const session = (token: string | null) =>
  token === null ? null : { access_token: token, user: { id: "u" } };

const fireAuth = async (event: string, token: string | null) => {
  await act(async () => {
    h.authCb.fn?.(event, session(token));
    await Promise.resolve();
  });
};

beforeEach(async () => {
  h.reconnectSocket.mockReset();
  h.getHandshakeToken.mockReset();
  h.getSession.mockResolvedValue({ data: { session: null } });
  h.authCb.fn = null;
  render(
    <AuthProvider>
      <div />
    </AuthProvider>,
  );
  await waitFor(() => expect(h.authCb.fn).not.toBeNull());
});

describe("AuthProvider — decisão de reconectar (Correção 1)", () => {
  it("NÃO reconecta quando o token do evento é igual ao do handshake atual", async () => {
    h.getHandshakeToken.mockReturnValue("tokA");
    await fireAuth("TOKEN_REFRESHED", "tokA");
    expect(h.reconnectSocket).not.toHaveBeenCalled();
  });

  it("reconecta quando o token mudou", async () => {
    h.getHandshakeToken.mockReturnValue("tokA");
    await fireAuth("TOKEN_REFRESHED", "tokB");
    expect(h.reconnectSocket).toHaveBeenCalledTimes(1);
  });

  it("reconecta quando o handshake era anônimo (null) e agora há token", async () => {
    h.getHandshakeToken.mockReturnValue(null);
    await fireAuth("SIGNED_IN", "tokB");
    expect(h.reconnectSocket).toHaveBeenCalledTimes(1);
  });

  it("NÃO reconecta no cold start antes do 1º handshake (getHandshakeToken === undefined)", async () => {
    h.getHandshakeToken.mockReturnValue(undefined);
    await fireAuth("INITIAL_SESSION", "tokB");
    expect(h.reconnectSocket).not.toHaveBeenCalled();
  });

  it("reconecta no logout (token vira null, handshake tinha token)", async () => {
    h.getHandshakeToken.mockReturnValue("tokA");
    await fireAuth("SIGNED_OUT", null);
    expect(h.reconnectSocket).toHaveBeenCalledTimes(1);
  });
});
