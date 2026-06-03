// Testes do gate do Leaderboard para usuários anônimos.
//
// No Android o blur nativo (expo-blur) não renderiza de forma confiável, então
// usamos um overlay sólido escuro. No iOS mantemos o BlurView. Aqui mockamos o
// BlurView com um testID pra distinguir os dois caminhos e checamos que o
// Android usa o overlay opaco (não o blur).

import { render, screen, waitFor } from "@testing-library/react-native";
import { Platform, StyleSheet } from "react-native";

// Prefixo `mock` é exigido pelo jest pra referência dentro de jest.mock().
const mockLimit = jest.fn();

jest.mock("../net/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => ({ order: () => ({ limit: mockLimit }) }) }),
    }),
  },
}));
jest.mock("../state/auth", () => ({ useAuth: jest.fn() }));
jest.mock("../hooks/useButtonSound", () => ({ playButtonSound: jest.fn() }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("expo-linking", () => ({ createURL: jest.fn(() => "barreira://auth") }));
// BlurView mockado com testID — assim sabemos se o caminho do blur nativo foi
// usado (iOS) ou não (Android).
jest.mock("expo-blur", () => {
  const { View } = require("react-native");
  return { BlurView: ({ children }: { children?: unknown }) => <View testID="blur-view">{children}</View> };
});

import { useAuth } from "../state/auth";
import { Leaderboard } from "../components/Leaderboard";

const useAuthMock = useAuth as jest.Mock;
const GATE_TEXT = "Crie uma conta pra competir";

const setOS = (os: "ios" | "android") => {
  Platform.OS = os;
};

beforeEach(() => {
  mockLimit.mockReset();
  // Anônimo (sem user) + ranking com dados → gate aparece.
  useAuthMock.mockReturnValue({ user: null, username: null });
  mockLimit.mockResolvedValue({
    data: [
      { username: "alice", trofeus_casual: 10 },
      { username: "bob", trofeus_casual: 5 },
    ],
    error: null,
  });
});

afterEach(() => {
  setOS("ios"); // restaura default do jest-expo
});

describe("Leaderboard — gate de anônimo", () => {
  it("Android: usa overlay sólido opaco (sem BlurView nativo)", async () => {
    setOS("android");
    render(<Leaderboard />);

    // Gate renderizado por cima da tabela.
    const gate = await screen.findByText(GATE_TEXT);
    expect(gate).toBeTruthy();
    // No Android NÃO deve usar o blur nativo.
    expect(screen.queryByTestId("blur-view")).toBeNull();

    // O container do overlay tem fundo escuro e opaco (esconde a tabela).
    // Sobe a árvore a partir do texto do gate até achar o container do overlay.
    let node: typeof gate | null = gate;
    let style: Record<string, unknown> = {};
    for (let i = 0; i < 6 && node; i++) {
      style = StyleSheet.flatten(node.props?.style) ?? {};
      if (style.backgroundColor === "rgba(20,28,46,0.94)") break;
      node = node.parent;
    }
    expect(style.backgroundColor).toBe("rgba(20,28,46,0.94)");
    expect(style.position).toBe("absolute");
  });

  it("iOS: mantém o BlurView nativo sobre a tabela", async () => {
    setOS("ios");
    render(<Leaderboard />);

    expect(await screen.findByText(GATE_TEXT)).toBeTruthy();
    expect(screen.getByTestId("blur-view")).toBeTruthy();
  });

  it("usuário logado: sem gate (tabela completa visível)", async () => {
    setOS("android");
    useAuthMock.mockReturnValue({ user: { id: "u1" }, username: "alice" });
    render(<Leaderboard />);

    // "bob" é nó de texto simples (sem "(você)" aninhado) — match exato.
    expect(await screen.findByText("bob")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(GATE_TEXT)).toBeNull());
    expect(screen.queryByTestId("blur-view")).toBeNull();
  });
});
