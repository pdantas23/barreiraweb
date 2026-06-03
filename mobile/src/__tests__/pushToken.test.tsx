import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

const mockRegisterPushToken = jest.fn().mockResolvedValue({ ok: true });

jest.mock("../net/api", () => ({
  registerPushToken: (...args: unknown[]) => mockRegisterPushToken(...args),
}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: "ExpoTok123" }),
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "pid" } } } },
}));

import { usePushToken } from "../hooks/usePushToken";

const Harness = ({ logged }: { logged: boolean }) => {
  usePushToken(logged);
  return <Text>harness</Text>;
};

beforeEach(() => mockRegisterPushToken.mockClear());

describe("usePushToken", () => {
  it("registra o push token no server ao logar", async () => {
    render(<Harness logged={true} />);
    await waitFor(() =>
      expect(mockRegisterPushToken).toHaveBeenCalledWith("ExpoTok123", "ios"),
    );
  });

  it("não registra quando não está logado", async () => {
    render(<Harness logged={false} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });
});
