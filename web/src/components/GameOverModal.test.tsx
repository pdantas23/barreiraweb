import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../hooks/useGameResultSound", () => ({ useGameResultSound: vi.fn() }));
vi.mock("../state/audioSettings", () => ({ useAudioSettings: () => ({ sfxEnabled: false }) }));

import { GameOverModal } from "./GameOverModal";

const baseProps = {
  visible: true as boolean,
  winner: 1 as 1 | 2 | null,
  onRematch: vi.fn(),
  onBackToMenu: vi.fn(),
};

describe("GameOverModal", () => {
  it("mostra título de vitória quando winner === 1", () => {
    render(<GameOverModal {...baseProps} winner={1} />);
    expect(screen.getByText(/Vitoria/i)).toBeInTheDocument();
  });

  it("mostra título de derrota quando winner === 2", () => {
    render(<GameOverModal {...baseProps} winner={2} />);
    expect(screen.getByText(/Derrota/i)).toBeInTheDocument();
  });

  it("não renderiza nada quando visible=false", () => {
    const { container } = render(<GameOverModal {...baseProps} visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o botão de replay quando replayAvailable + onWatchReplay e dispara o callback", () => {
    const onWatchReplay = vi.fn();
    render(<GameOverModal {...baseProps} replayAvailable onWatchReplay={onWatchReplay} />);
    const btn = screen.getByText(/Ver replay/i);
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onWatchReplay).toHaveBeenCalledTimes(1);
  });

  it("esconde o botão de replay quando replayAvailable=false", () => {
    render(<GameOverModal {...baseProps} replayAvailable={false} onWatchReplay={vi.fn()} />);
    expect(screen.queryByText(/Ver replay/i)).not.toBeInTheDocument();
  });

  it("mostra mensagem de timeout quando reason='timeout'", () => {
    render(<GameOverModal {...baseProps} winner={1} reason="timeout" />);
    expect(screen.getByText(/Tempo esgotado/i)).toBeInTheDocument();
  });
});
