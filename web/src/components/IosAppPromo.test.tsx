import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { IosAppPromo } from "./IosAppPromo";

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605";

const setUA = (ua: string) =>
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });

const TITLE = "Melhor no app";

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("IosAppPromo", () => {
  it("no iOS: aparece só DEPOIS de 1.5s (não instantâneo)", () => {
    setUA(IPHONE_UA);
    render(<IosAppPromo />);

    // Antes do delay → nada.
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1400));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();

    // Após 1.5s → aparece, com badge da App Store.
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /App Store/i })).toBeInTheDocument();
    expect(screen.getByText(/iPhone com a experiência completa/i)).toBeInTheDocument();
  });

  it("link aponta para a App Store e o X fecha sem navegar", () => {
    setUA(IPHONE_UA);
    render(<IosAppPromo />);
    act(() => vi.advanceTimersByTime(1500));

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://apps.apple.com/br/app/barreira/id6772620765");
    expect(link).toHaveAttribute("target", "_blank");

    fireEvent.click(screen.getByLabelText("Fechar"));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("NÃO aparece no Android", () => {
    setUA(ANDROID_UA);
    render(<IosAppPromo />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("NÃO aparece no desktop", () => {
    setUA(DESKTOP_UA);
    render(<IosAppPromo />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("uma vez por sessão: não reaparece se sessionStorage já marcou", () => {
    setUA(IPHONE_UA);
    sessionStorage.setItem("barreira.ios_promo_shown", "1");
    render(<IosAppPromo />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("marca o sessionStorage ao aparecer (pra não repetir na sessão)", () => {
    setUA(IPHONE_UA);
    render(<IosAppPromo />);
    expect(sessionStorage.getItem("barreira.ios_promo_shown")).toBeNull();
    act(() => vi.advanceTimersByTime(1500));
    expect(sessionStorage.getItem("barreira.ios_promo_shown")).toBe("1");
  });
});
