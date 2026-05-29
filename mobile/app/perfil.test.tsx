import { render, screen, waitFor } from "@testing-library/react-native";

// Factories inline (sem referência a variáveis externas) — seguro contra a
// ordem de inicialização do jest-expo, que requer expo-router cedo.
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
}));
jest.mock("../src/state/auth", () => ({ useAuth: jest.fn() }));
jest.mock("../src/hooks/useButtonSound", () => ({ playButtonSound: jest.fn(), useButtonSound: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { router } from "expo-router";
import { useAuth } from "../src/state/auth";
import ProfileScreen from "./perfil";

const replace = router.replace as jest.Mock;
const useAuthMock = useAuth as jest.Mock;

beforeEach(() => {
  replace.mockReset();
});

describe("perfil — usuário autenticado", () => {
  it("mostra username, email e troféus", () => {
    useAuthMock.mockReturnValue({
      user: { email: "alice@example.com" },
      username: "alice",
      trofeusCasual: 7,
      signOut: jest.fn(),
      loading: false,
    });
    render(<ProfileScreen />);
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("alice@example.com")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(replace).not.toHaveBeenCalledWith("/");
  });
});

describe("perfil — usuário anônimo / sessão expirada", () => {
  it("redireciona pra home", async () => {
    useAuthMock.mockReturnValue({ user: null, username: null, trofeusCasual: null, signOut: jest.fn(), loading: false });
    render(<ProfileScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("NÃO redireciona enquanto a sessão ainda carrega", () => {
    useAuthMock.mockReturnValue({ user: null, username: null, trofeusCasual: null, signOut: jest.fn(), loading: true });
    render(<ProfileScreen />);
    expect(replace).not.toHaveBeenCalledWith("/");
  });
});
