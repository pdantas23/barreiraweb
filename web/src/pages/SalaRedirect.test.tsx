// Testes da landing /sala/:codigo (deep link compartilhado).
//
// O componente agora mostra um modal "Entrar na partida" (sem auto-join e sem
// tentar o scheme custom). Só ao clicar é que navega pro auto-join da Home
// (/?join=CODE[&pw=]). A abertura no app fica por conta dos Universal Links.

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import SalaRedirect from "./SalaRedirect";

// Sentinela na Home pra inspecionar o destino do auto-join.
const HomeProbe = () => {
  const loc = useLocation();
  return <div data-testid="home">{loc.search}</div>;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sala/:codigo" element={<SalaRedirect />} />
        <Route path="/" element={<HomeProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe("SalaRedirect", () => {
  it("mostra o modal com o código da sala (em maiúsculo) e não entra sozinho", () => {
    renderAt("/sala/abcd");
    expect(screen.getByText("Convite para partida")).toBeInTheDocument();
    expect(screen.getByText("ABCD")).toBeInTheDocument();
    // Não navegou pro auto-join sozinho.
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();
  });

  it("clicar em 'Entrar na partida' navega pro auto-join /?join=CODE", () => {
    renderAt("/sala/abcd");
    fireEvent.click(screen.getByText("Entrar na partida"));
    expect(screen.getByTestId("home")).toHaveTextContent("join=ABCD");
  });

  it("propaga a senha (?pw=) no auto-join", () => {
    renderAt("/sala/abcd?pw=1234");
    fireEvent.click(screen.getByText("Entrar na partida"));
    const home = screen.getByTestId("home");
    expect(home).toHaveTextContent("join=ABCD");
    expect(home).toHaveTextContent("pw=1234");
  });
});
