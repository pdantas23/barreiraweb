import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const h = vi.hoisted(() => ({
  sendFriendRequest: vi.fn(),
  auth: { current: { user: null as unknown, loading: false } },
}));

vi.mock("../net/api", () => ({ sendFriendRequest: h.sendFriendRequest }));
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
        <Route path="/amigo/:username" element={<AmigoRedirect />} />
        <Route path="/" element={<Probe />} />
        <Route path="/login" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  h.sendFriendRequest.mockReset();
  h.auth.current = { user: null, loading: false };
});

describe("/amigo/:username", () => {
  it("logado: envia pedido automaticamente e redireciona pra home com feedback", async () => {
    h.auth.current = { user: { id: "u1" }, loading: false };
    h.sendFriendRequest.mockResolvedValue({ ok: true });

    renderAt("/amigo/bob");

    await waitFor(() => expect(h.sendFriendRequest).toHaveBeenCalledWith("bob"));
    await waitFor(() =>
      expect(screen.getByTestId("loc")).toHaveTextContent("/?friend=sent%3Abob"),
    );
  });

  it("não logado: redireciona pro login preservando o destino", async () => {
    h.auth.current = { user: null, loading: false };
    renderAt("/amigo/bob");

    await waitFor(() =>
      expect(screen.getByTestId("loc")).toHaveTextContent("/login?next=%2Famigo%2Fbob"),
    );
    expect(h.sendFriendRequest).not.toHaveBeenCalled();
  });
});
