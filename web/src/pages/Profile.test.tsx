import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  auth: { current: {} as Record<string, unknown> },
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("../components/PageGate", () => ({ PageGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../hooks/useButtonSound", () => ({ playButtonSound: vi.fn(), useButtonSound: vi.fn() }));
vi.mock("../state/auth", () => ({ useAuth: () => h.auth.current }));

import ProfileScreen from "./Profile";

beforeEach(() => {
  h.navigate.mockReset();
});

describe("Profile — usuário autenticado", () => {
  it("mostra username, email e troféus", () => {
    h.auth.current = {
      user: { email: "alice@example.com" },
      username: "alice",
      trofeusCasual: 7,
      signOut: vi.fn(),
      loading: false,
    };
    render(<ProfileScreen />);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(h.navigate).not.toHaveBeenCalledWith("/login", { replace: true });
  });
});

describe("Profile — usuário anônimo", () => {
  it("redireciona para /login", async () => {
    h.auth.current = {
      user: null,
      username: null,
      trofeusCasual: null,
      signOut: vi.fn(),
      loading: false,
    };
    render(<ProfileScreen />);
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/login", { replace: true }));
  });

  it("NÃO redireciona enquanto a sessão ainda está carregando", () => {
    h.auth.current = {
      user: null,
      username: null,
      trofeusCasual: null,
      signOut: vi.fn(),
      loading: true,
    };
    render(<ProfileScreen />);
    expect(h.navigate).not.toHaveBeenCalledWith("/login", { replace: true });
  });
});
