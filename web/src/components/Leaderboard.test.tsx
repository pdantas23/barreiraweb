import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({ limit: vi.fn(), username: { current: null as string | null } }));

vi.mock("../net/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({ order: () => ({ limit: h.limit }) }),
      }),
    }),
  },
}));

vi.mock("../state/auth", () => ({ useAuth: () => ({ username: h.username.current }) }));

import { Leaderboard } from "./Leaderboard";

beforeEach(() => {
  h.limit.mockReset();
  h.username.current = null;
});

describe("Leaderboard", () => {
  it("renderiza o top com username e troféus, ordenado como veio do banco", async () => {
    h.limit.mockResolvedValue({
      data: [
        { username: "alice", trofeus_casual: 10 },
        { username: "bob", trofeus_casual: 5 },
      ],
      error: null,
    });

    render(<Leaderboard />);

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("destaca o usuário logado com '(voce)'", async () => {
    h.username.current = "alice";
    h.limit.mockResolvedValue({
      data: [{ username: "alice", trofeus_casual: 3 }],
      error: null,
    });
    render(<Leaderboard />);
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText(/\(voce\)/i)).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há jogadores", async () => {
    h.limit.mockResolvedValue({ data: [], error: null });
    render(<Leaderboard />);
    expect(await screen.findByText(/Nenhum jogador ainda/i)).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando o fetch falha", async () => {
    h.limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    render(<Leaderboard />);
    expect(await screen.findByText(/Nao foi possivel carregar o ranking/i)).toBeInTheDocument();
  });
});
