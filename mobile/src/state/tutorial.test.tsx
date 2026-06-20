import { render, act, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock do AsyncStorage — os jest.fn() são criados DENTRO da factory (sem
// referenciar nenhum const externo) pra fugir do TDZ: os `import` são içados
// acima das declarações do arquivo, então a factory não pode ler um const local.
// Pegamos os spies de volta pelo próprio import mockado abaixo.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

const mockStore = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

import {
  TutorialProvider,
  useTutorial,
  shouldShowTutorial,
} from "./tutorial";

type Captured = ReturnType<typeof useTutorial>;
let captured: Captured;
const Capture = () => {
  captured = useTutorial();
  return null;
};

beforeEach(() => {
  mockStore.getItem.mockReset();
  mockStore.setItem.mockReset();
  mockStore.setItem.mockResolvedValue(undefined);
});

describe("shouldShowTutorial (decisão pura)", () => {
  it("mostra só quando já carregou e ainda não viu", () => {
    expect(shouldShowTutorial(false, false)).toBe(true);
    expect(shouldShowTutorial(true, false)).toBe(false);
    expect(shouldShowTutorial(false, true)).toBe(false);
    expect(shouldShowTutorial(true, true)).toBe(false);
  });
});

describe("TutorialProvider (mobile)", () => {
  it("começa em loading e resolve pra seen=true quando o storage tem '1'", async () => {
    mockStore.getItem.mockResolvedValue("1");
    render(
      <TutorialProvider>
        <Capture />
      </TutorialProvider>,
    );
    await waitFor(() => expect(captured.loading).toBe(false));
    expect(captured.seen).toBe(true);
    // já viu → não mostra de novo
    expect(shouldShowTutorial(captured.seen, captured.loading)).toBe(false);
  });

  it("resolve pra seen=false na primeira execução (sem valor salvo)", async () => {
    mockStore.getItem.mockResolvedValue(null);
    render(
      <TutorialProvider>
        <Capture />
      </TutorialProvider>,
    );
    await waitFor(() => expect(captured.loading).toBe(false));
    expect(captured.seen).toBe(false);
    // primeira vez → mostra
    expect(shouldShowTutorial(captured.seen, captured.loading)).toBe(true);
  });

  it("markSeen persiste '1' e vira seen=true (não reaparece)", async () => {
    mockStore.getItem.mockResolvedValue(null);
    render(
      <TutorialProvider>
        <Capture />
      </TutorialProvider>,
    );
    await waitFor(() => expect(captured.loading).toBe(false));
    expect(captured.seen).toBe(false);

    await act(async () => {
      captured.markSeen();
      await Promise.resolve();
    });

    expect(mockStore.setItem).toHaveBeenCalledWith("tutorial_seen", "1");
    expect(captured.seen).toBe(true);
    expect(shouldShowTutorial(captured.seen, captured.loading)).toBe(false);
  });

  it("se o storage falhar na leitura, trata como não-visto (mostra)", async () => {
    mockStore.getItem.mockRejectedValue(new Error("boom"));
    render(
      <TutorialProvider>
        <Capture />
      </TutorialProvider>,
    );
    await waitFor(() => expect(captured.loading).toBe(false));
    expect(captured.seen).toBe(false);
  });
});
