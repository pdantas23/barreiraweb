import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FriendInviteDropdown } from "./FriendInviteDropdown";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const inviteAt = (msFromNow: number) => ({
  fromUsername: "alice",
  expiresAt: Date.now() + msFromNow,
});

describe("FriendInviteDropdown", () => {
  it("aparece ao receber convite, mostrando quem convidou", () => {
    render(<FriendInviteDropdown invite={inviteAt(30_000)} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText(/alice te convidou/i)).toBeInTheDocument();
  });

  it("não renderiza nada sem convite", () => {
    const { container } = render(
      <FriendInviteDropdown invite={null} onAccept={vi.fn()} onDecline={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("timer regressivo: conta de 30s pra baixo", () => {
    render(<FriendInviteDropdown invite={inviteAt(30_000)} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText(/expira em 30s/i)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/expira em 25s/i)).toBeInTheDocument();
  });

  it("aceitar e recusar disparam os callbacks com o fromUsername", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(<FriendInviteDropdown invite={inviteAt(30_000)} onAccept={onAccept} onDecline={onDecline} />);
    fireEvent.click(screen.getByLabelText("Aceitar convite"));
    expect(onAccept).toHaveBeenCalledWith("alice");
    fireEvent.click(screen.getByLabelText("Recusar convite"));
    expect(onDecline).toHaveBeenCalledWith("alice");
  });

  it("desaparece e chama onExpire quando o tempo acaba", () => {
    const onExpire = vi.fn();
    render(
      <FriendInviteDropdown invite={inviteAt(3_000)} onAccept={vi.fn()} onDecline={vi.fn()} onExpire={onExpire} />,
    );
    expect(screen.getByText(/alice te convidou/i)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_500));
    expect(screen.queryByText(/alice te convidou/i)).not.toBeInTheDocument();
    expect(onExpire).toHaveBeenCalled();
  });
});
