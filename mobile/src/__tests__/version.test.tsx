import { render, screen, fireEvent } from "@testing-library/react-native";
import { compareSemver, versionStatus } from "../version";
import { VersionGate } from "../components/VersionGate";

describe("versionStatus", () => {
  it("compareSemver lida com tamanhos diferentes", () => {
    expect(compareSemver("1.1", "1.1.0")).toBe(0);
    expect(compareSemver("1.0", "1.1")).toBe(-1);
    expect(compareSemver("1.2", "1.1.9")).toBe(1);
  });

  it("blocked quando abaixo do min", () => {
    expect(versionStatus("1.0", "1.1", "1.2")).toBe("blocked");
  });
  it("outdated quando >= min mas abaixo do latest", () => {
    expect(versionStatus("1.1", "1.0", "1.2")).toBe("outdated");
  });
  it("ok quando na última", () => {
    expect(versionStatus("1.2", "1.0", "1.2")).toBe("ok");
  });
});

describe("VersionGate", () => {
  it("blocked: modal não-dismissível (sem botão de fechar)", () => {
    render(<VersionGate status="blocked" onUpdate={jest.fn()} />);
    expect(screen.getByText("Nova versão disponível!")).toBeTruthy();
    expect(screen.getByLabelText("Atualizar agora")).toBeTruthy();
    // Não há como dispensar.
    expect(screen.queryByLabelText("Dispensar aviso de atualização")).toBeNull();
  });

  it("outdated: banner dismissível", () => {
    render(<VersionGate status="outdated" onUpdate={jest.fn()} />);
    expect(screen.getByText(/Atualização disponível/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dispensar aviso de atualização"));
    expect(screen.queryByText(/Atualização disponível/)).toBeNull();
  });

  it("ok: não renderiza nada", () => {
    const { toJSON } = render(<VersionGate status="ok" onUpdate={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it("clicar em atualizar chama onUpdate", () => {
    const onUpdate = jest.fn();
    render(<VersionGate status="blocked" onUpdate={onUpdate} />);
    fireEvent.press(screen.getByLabelText("Atualizar agora"));
    expect(onUpdate).toHaveBeenCalled();
  });
});
