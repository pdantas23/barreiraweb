import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import type { Friend } from "@barreira/shared";
import { FriendsList } from "../components/FriendsList";
import { AddFriend } from "../components/AddFriend";
import { FriendInviteBanner } from "../components/FriendInviteBanner";

const friends: Friend[] = [
  { username: "alice", status: "online" },
  { username: "bob", status: "offline" },
  { username: "carol", status: "in-game" },
];

describe("FriendsList (mobile)", () => {
  it("renderiza amigos com bolinha de status", () => {
    render(<FriendsList friends={friends} />);
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("bob")).toBeTruthy();
    expect(screen.getByText("carol")).toBeTruthy();
    expect(screen.getByLabelText("Online")).toBeTruthy();
    expect(screen.getByLabelText("Offline")).toBeTruthy();
    expect(screen.getByLabelText("Em partida")).toBeTruthy();
  });

  it("'Convidar' só para online e livre", () => {
    render(<FriendsList friends={friends} onInvite={jest.fn()} />);
    expect(screen.getByLabelText("Convidar alice")).toBeTruthy();
    expect(screen.queryByLabelText("Convidar bob")).toBeNull();
    expect(screen.queryByLabelText("Convidar carol")).toBeNull();
  });

  it("convidar dispara onInvite", () => {
    const onInvite = jest.fn();
    render(<FriendsList friends={friends} onInvite={onInvite} />);
    fireEvent.press(screen.getByLabelText("Convidar alice"));
    expect(onInvite).toHaveBeenCalledWith("alice");
  });
});

describe("AddFriend (mobile)", () => {
  it("envia pedido e mostra feedback", async () => {
    const onAdd = jest.fn().mockResolvedValue({ ok: true });
    render(<AddFriend onAdd={onAdd} />);
    fireEvent.changeText(screen.getByLabelText("Username do amigo"), "bob");
    fireEvent.press(screen.getByLabelText("Adicionar amigo"));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("bob"));
    expect(await screen.findByText("Pedido enviado!")).toBeTruthy();
  });
});

describe("FriendInviteBanner (mobile)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const inviteAt = (ms: number) => ({ fromUsername: "alice", expiresAt: Date.now() + ms });

  it("aparece com quem convidou e timer regressivo", () => {
    render(<FriendInviteBanner invite={inviteAt(30_000)} onAccept={jest.fn()} onDecline={jest.fn()} />);
    expect(screen.getByText(/alice te convidou/)).toBeTruthy();
    expect(screen.getByText(/expira em 30s/)).toBeTruthy();
    act(() => jest.advanceTimersByTime(5_000));
    expect(screen.getByText(/expira em 25s/)).toBeTruthy();
  });

  it("aceitar/recusar disparam callbacks", () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    render(<FriendInviteBanner invite={inviteAt(30_000)} onAccept={onAccept} onDecline={onDecline} />);
    fireEvent.press(screen.getByLabelText("Aceitar convite"));
    expect(onAccept).toHaveBeenCalledWith("alice");
    fireEvent.press(screen.getByLabelText("Recusar convite"));
    expect(onDecline).toHaveBeenCalledWith("alice");
  });

  it("some e chama onExpire ao expirar", () => {
    const onExpire = jest.fn();
    render(<FriendInviteBanner invite={inviteAt(3_000)} onAccept={jest.fn()} onDecline={jest.fn()} onExpire={onExpire} />);
    expect(screen.getByText(/alice te convidou/)).toBeTruthy();
    act(() => jest.advanceTimersByTime(3_500));
    expect(screen.queryByText(/alice te convidou/)).toBeNull();
    expect(onExpire).toHaveBeenCalled();
  });
});
