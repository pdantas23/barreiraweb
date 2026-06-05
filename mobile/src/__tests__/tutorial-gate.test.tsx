// Gate do tutorial na Home (app/index): na 1ª vez do dispositivo, a Home
// redireciona pro /tutorial ANTES de renderizar a tela inicial. Já visto →
// renderiza a Home normal. Ainda carregando a flag → não renderiza nem redireciona.

import { render, screen } from "@testing-library/react-native";

// Estado do tutorial controlado por teste. Lido só quando useTutorial é
// chamado (no render), então não há TDZ na factory.
const mockTut = { seen: false, loading: false };

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
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
jest.mock("../state/tutorial", () => ({
  useTutorial: () => ({ seen: mockTut.seen, loading: mockTut.loading, markSeen: jest.fn() }),
  shouldShowTutorial: (seen: boolean, loading: boolean) => !loading && !seen,
}));

import { router } from "expo-router";
import HomeScreen from "../../app/index";

const replace = router.replace as jest.Mock;

beforeEach(() => {
  replace.mockReset();
  mockTut.seen = false;
  mockTut.loading = false;
});

describe("Home — gate do tutorial (antes da tela inicial)", () => {
  it("1ª vez (não visto, carregado): redireciona pro /tutorial e NÃO mostra a home", () => {
    mockTut.seen = false;
    mockTut.loading = false;
    render(<HomeScreen />);
    expect(replace).toHaveBeenCalledWith("/tutorial");
    expect(screen.queryByText("Casual")).toBeNull();
  });

  it("já visto: NÃO redireciona e renderiza a home normal", () => {
    mockTut.seen = true;
    mockTut.loading = false;
    render(<HomeScreen />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("Casual")).toBeTruthy();
  });

  it("flag ainda carregando: não redireciona nem mostra a home (sem flash)", () => {
    mockTut.seen = false;
    mockTut.loading = true;
    render(<HomeScreen />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText("Casual")).toBeNull();
  });
});
