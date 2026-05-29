import { render, act, waitFor } from "@testing-library/react-native";

// Mocks init-safe: spies criados dentro das factories e expostos via getters.
jest.mock("../net/socket", () => ({
  reconnectSocket: jest.fn(),
  getHandshakeToken: jest.fn(),
}));
jest.mock("../net/supabase", () => {
  let cb: ((event: string, session: unknown) => void) | null = null;
  return {
    __getCb: () => cb,
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: (fn: (e: string, s: unknown) => void) => {
          cb = fn;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      }),
    },
  };
});

import { reconnectSocket, getHandshakeToken } from "../net/socket";
import * as supa from "../net/supabase";
import { AuthProvider } from "./auth";

const reconnect = reconnectSocket as jest.Mock;
const handshakeToken = getHandshakeToken as jest.Mock;
const getCb = (supa as unknown as { __getCb: () => (e: string, s: unknown) => void }).__getCb;

const session = (token: string | null) =>
  token === null ? null : { access_token: token, user: { id: "u" } };

const fire = async (event: string, token: string | null) => {
  await act(async () => {
    getCb()(event, session(token));
    await Promise.resolve();
  });
};

beforeEach(async () => {
  reconnect.mockReset();
  handshakeToken.mockReset();
  render(<AuthProvider>{null}</AuthProvider>);
  await waitFor(() => expect(getCb()).toBeTruthy());
});

describe("AuthProvider mobile — decisão de reconectar (CRÍTICO 2)", () => {
  it("NÃO reconecta quando o token é igual ao do handshake", async () => {
    handshakeToken.mockReturnValue("tokA");
    await fire("TOKEN_REFRESHED", "tokA");
    expect(reconnect).not.toHaveBeenCalled();
  });

  it("reconecta quando o token mudou", async () => {
    handshakeToken.mockReturnValue("tokA");
    await fire("TOKEN_REFRESHED", "tokB");
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it("reconecta quando o handshake era anônimo (null) e agora há token", async () => {
    handshakeToken.mockReturnValue(null);
    await fire("SIGNED_IN", "tokB");
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it("NÃO reconecta no cold start antes do 1º handshake (getHandshakeToken undefined)", async () => {
    handshakeToken.mockReturnValue(undefined);
    await fire("INITIAL_SESSION", "tokB");
    expect(reconnect).not.toHaveBeenCalled();
  });
});
