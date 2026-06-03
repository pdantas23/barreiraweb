// Testes da rota de deep link app/sala/[codigo].tsx.
//
// Tanto barreira://sala/CODIGO (scheme custom) quanto
// https://barreirajogo.com/sala/CODIGO (Universal/App Link) são resolvidos
// pelo Expo Router para o MESMO param `codigo` desta tela — então o handler é
// o mesmo. Aqui simulamos os params e verificamos: entra na sala (joinRoom) e
// navega pra /online-game; código vazio cai no lobby; erro de join avisa.

import { render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock("../net/api", () => ({ joinRoom: jest.fn() }));
jest.mock("../net/socket", () => ({
  clearLastGameStart: jest.fn(),
  connectSocket: jest.fn(),
}));
jest.mock("../state/profile", () => ({ usePlayerName: () => "tester" }));
// errorInfo real (função pura) — sem mock.

import { router, useLocalSearchParams } from "expo-router";
import { joinRoom } from "../net/api";
import SalaDeepLink from "../../app/sala/[codigo]";

const replace = router.replace as jest.Mock;
const params = useLocalSearchParams as jest.Mock;
const mockJoinRoom = joinRoom as jest.Mock;

beforeEach(() => {
  replace.mockReset();
  mockJoinRoom.mockReset();
  params.mockReturnValue({});
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  (Alert.alert as jest.Mock).mockRestore?.();
});

describe("sala deep link", () => {
  it("scheme custom (barreira://sala/ABCD): entra como convidado e vai pra /online-game", async () => {
    params.mockReturnValue({ codigo: "abcd" }); // expo-router resolve barreira://sala/abcd
    mockJoinRoom.mockResolvedValue({ ok: true, data: {} });

    render(<SalaDeepLink />);

    await waitFor(() =>
      expect(mockJoinRoom).toHaveBeenCalledWith({
        code: "ABCD",
        playerName: "tester",
        password: undefined,
      }),
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith({
        pathname: "/online-game",
        params: { role: "guest", code: "ABCD" },
      }),
    );
  });

  it("universal link (https://barreirajogo.com/sala/ABCD): mesmo fluxo", async () => {
    // Universal Link resolve para o mesmo param `codigo` que o scheme custom.
    params.mockReturnValue({ codigo: "ABCD" });
    mockJoinRoom.mockResolvedValue({ ok: true, data: {} });

    render(<SalaDeepLink />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith({
        pathname: "/online-game",
        params: { role: "guest", code: "ABCD" },
      }),
    );
  });

  it("propaga a senha (?pw=) no join e nos params da partida", async () => {
    params.mockReturnValue({ codigo: "ABCD", pw: "1234" });
    mockJoinRoom.mockResolvedValue({ ok: true, data: {} });

    render(<SalaDeepLink />);

    await waitFor(() =>
      expect(mockJoinRoom).toHaveBeenCalledWith({
        code: "ABCD",
        playerName: "tester",
        password: "1234",
      }),
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith({
        pathname: "/online-game",
        params: { role: "guest", code: "ABCD", password: "1234" },
      }),
    );
  });

  it("código vazio: vai pro lobby sem tentar entrar", async () => {
    params.mockReturnValue({ codigo: "" });

    render(<SalaDeepLink />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/online"));
    expect(mockJoinRoom).not.toHaveBeenCalled();
  });

  it("erro de join (sala cheia): mostra alerta e volta pro lobby", async () => {
    params.mockReturnValue({ codigo: "ABCD" });
    mockJoinRoom.mockResolvedValue({ ok: false, error: "room-full" });

    render(<SalaDeepLink />);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/online");
    // Não navega pra partida em caso de erro.
    expect(replace).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/online-game" }),
    );
  });
});
