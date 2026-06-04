import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const h = vi.hoisted(() => ({
  redeemFriendInvite: vi.fn(),
  auth: { current: { user: null as unknown, loading: false } },
}));

vi.mock("../net/api", () => ({ redeemFriendInvite: h.redeemFriendInvite }));
vi.mock("../state/auth", () => ({ useAuth: () => h.auth.current }));

import AmigoRedirect from "./AmigoRedirect";

const Probe = () => {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/amigo/:token" element={<AmigoRedirect />} />
        <Route path="/" element={<Probe />} />
        <Route path="/login" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  h.redeemFriendInvite.mockReset();
  h.auth.current = { user: null, loading: false };
});

describe("/amigo/:token", () => {
  it("logado: resgata o token e abre o modal de aceitar na home", async () => {
    h.auth.current = { user: { id: "u1" }, loading: false };
    h.redeemFriendInvite.mockResolvedValue({ ok: true, data: { fromUsername: "alice", trofeus: 3 } });

    renderAt("/amigo/tok123");

    await waitFor(() => expect(h.redeemFriendInvite).toHaveBeenCalledWith("tok123"));
    await waitFor(() =>
      expect(screen.getByTestId("loc")).toHaveTextContent("/?friendInvite=alice"),
    );
  });

  it("logado: link expirado redireciona com feedback de erro", async () => {
    h.auth.current = { user: { id: "u1" }, loading: false };
    h.redeemFriendInvite.mockResolvedValue({ ok: false, error: "invite-expired" });

    renderAt("/amigo/velho");

    await waitFor(() =>
      expect(screen.getByTestId("loc")).toHaveTextContent("/?friend=expired"),
    );
  });

  it("não logado: redireciona pro login preservando o destino", async () => {
    h.auth.current = { user: null, loading: false };
    renderAt("/amigo/tok123");

    await waitFor(() =>
      expect(screen.getByTestId("loc")).toHaveTextContent("/login?next=%2Famigo%2Ftok123"),
    );
    expect(h.redeemFriendInvite).not.toHaveBeenCalled();
  });
});
