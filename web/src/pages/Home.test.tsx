// Testes do troféu (leaderboard) na navbar + modal do leaderboard na Home.
//
// O troféu vive na navbar (header), à esquerda dos botões de auth/config, e
// abre um modal com o <Leaderboard /> dentro. Como o componente do modal é
// inline na Home, renderizamos a Home inteira mockando as dependências de
// rede/áudio. O Leaderboard real roda dentro do modal (supabase mockado).
//
// NOTA: o Leaderboard da WEB não tem gate de blur — esse overlay para
// anônimos é exclusivo do app mobile. Por isso aqui, logado ou não, a tabela
// aparece completa; só muda o destaque "(voce)". Ver os testes do mobile
// (src/__tests__/leaderboard.test.tsx) para o overlay opaco do Android.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({
  limit: vi.fn(),
  auth: { current: { user: null as { email?: string } | null, username: null as string | null } },
}));

// --- Rede / áudio / estado: mocks leves ---
vi.mock("../net/socket", () => ({
  connectSocket: () => ({ on: vi.fn(), off: vi.fn() }),
  clearLastGameStart: vi.fn(),
}));
vi.mock("../net/api", () => ({
  listRooms: vi.fn().mockResolvedValue({ ok: true, data: { rooms: [] } }),
  joinRoom: vi.fn(),
  createRoom: vi.fn(),
  // FriendsHub (renderizado na navbar) consome estas — sem o mock, getFriends()
  // no mount vira unhandled rejection e o vitest sai com erro mesmo passando.
  getFriends: vi.fn().mockResolvedValue({
    ok: true,
    data: { friends: [], incomingRequests: [], outgoingRequests: [] },
  }),
  sendFriendRequest: vi.fn().mockResolvedValue({ ok: true }),
  acceptFriendRequest: vi.fn().mockResolvedValue({ ok: true }),
  declineFriendRequest: vi.fn().mockResolvedValue({ ok: true }),
  removeFriend: vi.fn().mockResolvedValue({ ok: true }),
  createFriendInviteLink: vi.fn().mockResolvedValue({ ok: true, data: { url: "" } }),
  sendGameInvite: vi.fn().mockResolvedValue({ ok: true }),
  respondGameInvite: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../hooks/useButtonSound", () => ({
  playButtonSound: vi.fn(),
  useButtonSound: vi.fn(),
  setSfxEnabledForSounds: vi.fn(),
}));
vi.mock("../hooks/usePieceSound", () => ({ setSfxEnabledForPiece: vi.fn() }));
vi.mock("../hooks/useWallSound", () => ({ setSfxEnabledForWall: vi.fn() }));
vi.mock("../hooks/useMenuMusic", () => ({ useMenuMusic: vi.fn() }));
vi.mock("../state/audioSettings", () => ({
  useAudioSettings: () => ({
    musicEnabled: false,
    sfxEnabled: false,
    setMusicEnabled: vi.fn(),
    setSfxEnabled: vi.fn(),
  }),
}));
vi.mock("../state/profile", () => ({ usePlayerName: () => "tester" }));
// IosAppPromo tem timers/UA próprios — fora do escopo, vira no-op.
vi.mock("../components/IosAppPromo", () => ({ IosAppPromo: () => null }));

// Leaderboard: supabase + useAuth mockados (componente real roda no modal).
vi.mock("../net/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => ({ order: () => ({ limit: h.limit }) }) }),
    }),
  },
}));
vi.mock("../state/auth", () => ({ useAuth: () => h.auth.current }));

import HomeScreen from "./Home";

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomeScreen />
    </MemoryRouter>,
  );

// jsdom desta config não expõe localStorage — Home usa pra flag de privacidade.
beforeEach(() => {
  const store = new Map<string, string>([["privacy_accepted", "1"]]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });

  h.limit.mockReset();
  h.limit.mockResolvedValue({
    data: [
      { username: "alice", trofeus_casual: 10 },
      { username: "bob", trofeus_casual: 5 },
    ],
    error: null,
  });
  h.auth.current = { user: null, username: null };
});

describe("Home — troféu (leaderboard) na navbar", () => {
  it("renderiza o troféu na navbar (header), não mais flutuante", () => {
    renderHome();
    const btn = screen.getByLabelText("Ver leaderboard");
    expect(btn).toBeInTheDocument();
    // Vive na navbar: botão redondo dentro do <header>, sem posicionamento fixo.
    expect(btn).toHaveClass("rounded-full");
    expect(btn).not.toHaveClass("fixed");
    expect(btn.closest("header")).not.toBeNull();
  });

  it("o leaderboard não aparece inline — só dentro do modal", () => {
    renderHome();
    // Fechado: sem o cabeçalho LEADERBOARD em lugar nenhum.
    expect(screen.queryByText("LEADERBOARD")).not.toBeInTheDocument();
  });

  it("clicar no ícone abre o modal com o ranking", async () => {
    renderHome();
    fireEvent.click(screen.getByLabelText("Ver leaderboard"));

    expect(await screen.findByText("LEADERBOARD")).toBeInTheDocument();
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("clicar no X fecha o modal", async () => {
    renderHome();
    fireEvent.click(screen.getByLabelText("Ver leaderboard"));
    expect(await screen.findByText("LEADERBOARD")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Fechar"));
    await waitFor(() =>
      expect(screen.queryByText("LEADERBOARD")).not.toBeInTheDocument(),
    );
  });

  it("usuário autenticado: tabela completa, destacando '(voce)'", async () => {
    h.auth.current = { user: { email: "alice@x.com" }, username: "alice" };
    renderHome();
    fireEvent.click(screen.getByLabelText("Ver leaderboard"));

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText(/\(voce\)/i)).toBeInTheDocument();
  });

  it("usuário não autenticado: tabela completa e SEM overlay (web não tem blur)", async () => {
    h.auth.current = { user: null, username: null };
    renderHome();
    fireEvent.click(screen.getByLabelText("Ver leaderboard"));

    // Tabela visível por completo.
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    // Sem destaque de "você" e sem CTA de gate (gate é mobile-only).
    expect(screen.queryByText(/\(voce\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Crie uma conta pra competir/i)).not.toBeInTheDocument();
  });
});
