import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FriendsList } from "./FriendsList";
import type { Friend } from "@barreira/shared";

const friends: Friend[] = [
  { username: "alice", status: "online" },
  { username: "bob", status: "offline" },
  { username: "carol", status: "in-game" },
];

describe("FriendsList", () => {
  it("renderiza os amigos com bolinha de status", () => {
    render(<FriendsList friends={friends} />);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("carol")).toBeInTheDocument();
    // Bolinhas com data-status refletindo o estado.
    expect(screen.getByLabelText("Online")).toHaveAttribute("data-status", "online");
    expect(screen.getByLabelText("Offline")).toHaveAttribute("data-status", "offline");
    expect(screen.getByLabelText("Em partida")).toHaveAttribute("data-status", "in-game");
  });

  it("mostra 'Convidar' só para amigos online e livres", () => {
    render(<FriendsList friends={friends} onInvite={vi.fn()} />);
    // online → tem botão
    expect(screen.getByLabelText("Convidar alice")).toBeInTheDocument();
    // offline e em-partida → sem botão de convite
    expect(screen.queryByLabelText("Convidar bob")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Convidar carol")).not.toBeInTheDocument();
  });

  it("clicar em Convidar dispara onInvite com o username", () => {
    const onInvite = vi.fn();
    render(<FriendsList friends={friends} onInvite={onInvite} />);
    fireEvent.click(screen.getByLabelText("Convidar alice"));
    expect(onInvite).toHaveBeenCalledWith("alice");
  });

  it("pedidos recebidos: aceitar e recusar disparam callbacks", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(
      <FriendsList friends={[]} incomingRequests={["dave"]} onAccept={onAccept} onDecline={onDecline} />,
    );
    fireEvent.click(screen.getByLabelText("Aceitar dave"));
    expect(onAccept).toHaveBeenCalledWith("dave");
    fireEvent.click(screen.getByLabelText("Recusar dave"));
    expect(onDecline).toHaveBeenCalledWith("dave");
  });
});
