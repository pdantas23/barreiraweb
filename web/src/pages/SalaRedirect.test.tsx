// Testes do redirect /sala/:codigo (deep link compartilhado).
//
// O componente: em desktop cai direto no auto-join (/?join=CODE); em mobile
// tenta o scheme custom (barreira://sala/CODE) e, se nada acontecer em 1.5s,
// segue no site. Aqui mockamos navigator.userAgent, window.location.href
// (capturado) e usamos roteamento real do React Router pra observar o destino.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import SalaRedirect from "./SalaRedirect";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605";

const setUA = (ua: string) =>
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });

// Sentinela renderizada na Home pra inspecionar o destino do auto-join.
const HomeProbe = () => {
  const loc = useLocation();
  return <div data-testid="home">{loc.search}</div>;
};

// Stub de window.location só pra capturar o `href =` do deep link (jsdom não
// navega pra schemes custom). React Router (MemoryRouter) usa history em
// memória, então não depende de window.location.
let hrefSpy: ReturnType<typeof vi.fn>;
let realLocation: Location;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sala/:codigo" element={<SalaRedirect />} />
        <Route path="/" element={<HomeProbe />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.useFakeTimers();
  hrefSpy = vi.fn();
  realLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      get href() {
        return "";
      },
      set href(v: string) {
        hrefSpy(v);
      },
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: realLocation,
  });
});

describe("SalaRedirect", () => {
  it("desktop: cai direto no auto-join /?join=CODE sem tentar deep link", () => {
    setUA(DESKTOP_UA);
    renderAt("/sala/abcd");

    // Navegou pra Home com o param de auto-join (code em maiúsculo).
    expect(screen.getByTestId("home")).toHaveTextContent("join=ABCD");
    // Não tentou abrir app.
    expect(hrefSpy).not.toHaveBeenCalled();
  });

  it("iOS: tenta abrir o app via scheme custom (barreira://sala/CODE)", () => {
    setUA(IPHONE_UA);
    renderAt("/sala/abcd");

    expect(hrefSpy).toHaveBeenCalledWith("barreira://sala/ABCD");
    // Antes do timeout, ainda não redirecionou pro site.
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();
  });

  it("Android: tenta abrir o app via scheme custom (barreira://sala/CODE)", () => {
    setUA(ANDROID_UA);
    renderAt("/sala/abcd");

    expect(hrefSpy).toHaveBeenCalledWith("barreira://sala/ABCD");
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();
  });

  it("mobile: passados 1.5s sem o app abrir, segue no site (auto-join)", () => {
    setUA(ANDROID_UA);
    renderAt("/sala/abcd");

    expect(screen.queryByTestId("home")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByTestId("home")).toHaveTextContent("join=ABCD");
  });

  it("mobile: se o app abriu (aba escondida), NÃO redireciona após o timeout", () => {
    setUA(IPHONE_UA);
    renderAt("/sala/abcd");

    // Simula o app abrindo: a aba vai pro background.
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();

    // Restaura pra não vazar pros outros testes.
    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
  });

  it("propaga a senha (?pw=) no deep link e no auto-join", () => {
    setUA(ANDROID_UA);
    renderAt("/sala/abcd?pw=1234");

    expect(hrefSpy).toHaveBeenCalledWith("barreira://sala/ABCD?pw=1234");
    act(() => vi.advanceTimersByTime(1500));
    const home = screen.getByTestId("home");
    expect(home).toHaveTextContent("join=ABCD");
    expect(home).toHaveTextContent("pw=1234");
  });
});
