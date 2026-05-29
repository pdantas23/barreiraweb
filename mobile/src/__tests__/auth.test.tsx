// Fica fora de app/ (pasta de rotas do Expo Router) pra não entrar no bundle.
import { render, waitFor } from "@testing-library/react-native";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock("../state/auth", () => {
  const setSessionFromTokens = jest.fn();
  return { useAuth: () => ({ setSessionFromTokens }), __setSession: setSessionFromTokens };
});
jest.mock("expo-web-browser", () => ({ dismissBrowser: jest.fn().mockResolvedValue(undefined) }));

import { router, useLocalSearchParams } from "expo-router";
import * as authMod from "../state/auth";
import AuthCallback from "../../app/auth";

const replace = router.replace as jest.Mock;
const params = useLocalSearchParams as jest.Mock;
const setSession = (authMod as unknown as { __setSession: jest.Mock }).__setSession;

beforeEach(() => {
  replace.mockReset();
  setSession.mockReset();
  params.mockReturnValue({});
});

describe("auth deep link", () => {
  it("hidrata a sessão com os tokens e navega pra /perfil", async () => {
    params.mockReturnValue({ access_token: "acc", refresh_token: "ref" });
    setSession.mockResolvedValue({ ok: true });

    render(<AuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/perfil"));
    expect(setSession).toHaveBeenCalledWith({ access_token: "acc", refresh_token: "ref" });
  });

  it("se a hidratação falhar, volta pra home", async () => {
    params.mockReturnValue({ access_token: "acc", refresh_token: "ref" });
    setSession.mockResolvedValue({ ok: false });

    render(<AuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("sem tokens: volta pra home sem hidratar sessão", async () => {
    params.mockReturnValue({});
    render(<AuthCallback />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(setSession).not.toHaveBeenCalled();
  });
});
