import { describe, it, expect } from "vitest";
import { isAllowedOrigin } from "./cors.js";

describe("isAllowedOrigin", () => {
  it("libera app nativo (sem Origin)", () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin(null)).toBe(true);
    expect(isAllowedOrigin("")).toBe(true);
  });

  it("libera os domínios do jogo (web prod)", () => {
    expect(isAllowedOrigin("https://barreirajogo.com")).toBe(true);
    expect(isAllowedOrigin("https://www.barreirajogo.com")).toBe(true);
  });

  it("libera dev local (Vite / Expo simulador)", () => {
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("http://localhost:8081")).toBe(true);
  });

  it("libera Expo Go num device (exp:// e LAN) — conserta o mobile", () => {
    expect(isAllowedOrigin("exp://192.168.1.5:8081")).toBe(true);
    expect(isAllowedOrigin("exps://192.168.0.10:8081")).toBe(true);
    expect(isAllowedOrigin("http://192.168.1.5:8081")).toBe(true);
    expect(isAllowedOrigin("http://10.0.0.7:8081")).toBe(true);
    expect(isAllowedOrigin("http://172.16.3.9:19000")).toBe(true);
  });

  it("BLOQUEIA sites http/https arbitrários (proteção CORS mantida)", () => {
    expect(isAllowedOrigin("https://evil.com")).toBe(false);
    expect(isAllowedOrigin("http://evil.com")).toBe(false);
    expect(isAllowedOrigin("https://barreirajogo.com.evil.com")).toBe(false);
    // IP público não-LAN também é bloqueado
    expect(isAllowedOrigin("http://8.8.8.8:8081")).toBe(false);
  });
});
