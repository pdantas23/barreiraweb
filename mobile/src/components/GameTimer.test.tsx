import { renderHook, act } from "@testing-library/react-native";

// O hook useGameTimers não usa reanimated (só o componente GameTimer usa).
// Mockamos reanimated pra o import do módulo não exigir o runtime nativo.
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: () => null },
  useAnimatedStyle: () => ({}),
  useSharedValue: () => ({ value: 0 }),
  withRepeat: (v: unknown) => v,
  withTiming: (v: unknown) => v,
  cancelAnimation: () => {},
}));

import { useGameTimers } from "./GameTimer";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useGameTimers (mobile)", () => {
  it("inicia ambos os relógios no tempo total", () => {
    const { result } = renderHook(() => useGameTimers(1, null, false, 1000));
    expect(result.current.p1TimeMs).toBe(1000);
    expect(result.current.p2TimeMs).toBe(1000);
    expect(result.current.timedOutPlayer).toBeNull();
  });

  it("debita o relógio do jogador da vez e marca timedOutPlayer ao zerar", () => {
    const { result } = renderHook(() => useGameTimers(1, null, false, 300));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current.p1TimeMs).toBe(0);
    expect(result.current.timedOutPlayer).toBe(1);
  });

  it("resetTimers restaura os relógios e limpa timedOutPlayer (caso da revanche)", () => {
    const { result } = renderHook(() => useGameTimers(1, null, false, 300));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current.timedOutPlayer).toBe(1);

    act(() => {
      result.current.resetTimers();
    });
    expect(result.current.p1TimeMs).toBe(300);
    expect(result.current.p2TimeMs).toBe(300);
    expect(result.current.timedOutPlayer).toBeNull();
  });
});
