// Garante que a navbar inferior (Treino/Casual) respeita o inset inferior do
// sistema (barra de navegação do Android), via useSafeAreaInsets. Sem isso os
// botões ficavam atrás da barra. Renderizamos a Home (app/index) com o inset
// mockado e checamos que a navbar somou o inset à altura + paddingBottom.

import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

const BOTTOM_INSET = 34;

// Reanimated: mock leve (Animated.View vira View, hooks viram passthrough) pra
// a navbar/abas renderizarem sem o runtime de animação no jest.
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (c: unknown) => c,
    },
    Easing: { out: () => 0, in: () => 0, ease: 0 },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (v: unknown) => v,
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: ({ children, ...p }: { children?: unknown }) => <View {...p}>{children}</View> };
});
// TopBar e GridBackground têm deps próprias (web-browser, linking, etc.) e não
// são o foco — viram no-op.
jest.mock("../components/TopBar", () => ({ TopBar: () => null }));
jest.mock("../components/GridBackground", () => ({ GridBackground: () => null }));

jest.mock("../hooks/useButtonSound", () => ({
  playButtonSound: jest.fn(),
  useButtonSound: jest.fn(),
  setSfxEnabledForSounds: jest.fn(),
}));
jest.mock("../hooks/usePieceSound", () => ({ setSfxEnabledForPiece: jest.fn() }));
jest.mock("../hooks/useWallSound", () => ({ setSfxEnabledForWall: jest.fn() }));
jest.mock("../hooks/useMenuMusic", () => ({ useMenuMusic: jest.fn() }));
jest.mock("../state/audioSettings", () => ({
  useAudioSettings: () => ({
    musicEnabled: false,
    sfxEnabled: false,
    setMusicEnabled: jest.fn(),
    setSfxEnabled: jest.fn(),
  }),
}));

import HomeScreen from "../../app/index";

describe("Home — safe area da navbar inferior", () => {
  it("aplica o inset inferior na navbar (altura + paddingBottom)", () => {
    render(<HomeScreen />);

    // Sobe do texto "Casual" até achar a navbar (container que carrega o
    // paddingBottom/height derivados do inset).
    let node: ReturnType<typeof screen.getByText> | null = screen.getByText("Casual");
    let style: Record<string, unknown> = {};
    for (let i = 0; i < 8 && node; i++) {
      style = StyleSheet.flatten(node.props?.style) ?? {};
      if (style.paddingBottom === BOTTOM_INSET) break;
      node = node.parent;
    }

    // paddingBottom = max(inset, 8) = 34; height = 70 + 34 = 104.
    expect(style.paddingBottom).toBe(BOTTOM_INSET);
    expect(style.height).toBe(70 + BOTTOM_INSET);
  });
});
