import type { PlayerId } from "@barreira/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
// import { AdInterstitial } from "../ads/AdInterstitial";
// import { AD_SLOTS } from "../ads/adsConfig";
import { CountdownOverlay } from "./CountdownOverlay";
import { GameOverModal, type GameOverReason } from "./GameOverModal";

interface GameOverlaysProps {
  countdownActive: boolean;
  countdownStartsAt: number;
  onCountdownComplete: () => void;
  winner: PlayerId | null;
  reloadDefeat: boolean;
  gameOverReason: GameOverReason;
  onRematch: () => void;
  showReloadWarning: boolean;
  onDismissReloadWarning: () => void;
  onConfirmReloadDefeat: () => void;
}

export function GameOverlays({
  countdownActive,
  countdownStartsAt,
  onCountdownComplete,
  winner,
  reloadDefeat,
  gameOverReason,
  onRematch,
  showReloadWarning,
  onDismissReloadWarning,
  onConfirmReloadDefeat,
}: GameOverlaysProps) {
  const navigate = useNavigate();

  // Interstitial: aparece ao fim de cada partida
  const [interstitialVisible, setInterstitialVisible] = useState(false);
  const [interstitialChecked, setInterstitialChecked] = useState(false);

  if (winner !== null && !reloadDefeat && !interstitialChecked) {
    setInterstitialChecked(true);
    setInterstitialVisible(true);
  }

  if (winner === null && interstitialChecked) {
    setInterstitialChecked(false);
    setInterstitialVisible(false);
  }

  return (
    <>
      {countdownActive && (
        <CountdownOverlay startsAt={countdownStartsAt} onComplete={onCountdownComplete} />
      )}

      <GameOverModal visible={winner !== null && !reloadDefeat} winner={winner} reason={gameOverReason} onRematch={onRematch} onBackToMenu={() => navigate("/")} />

      {/* <AdInterstitial
        visible={interstitialVisible}
        slot={AD_SLOTS.interstitial}
        closeDelay={5}
        onClose={() => setInterstitialVisible(false)}
      /> */}

      {/* Reload warning modal */}
      {showReloadWarning && !reloadDefeat && (
        <div
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(26, 42, 74, 0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, zIndex: 300, animation: "fadeIn 150ms ease-out",
          }}
        >
          <div
            style={{
              width: "100%", maxWidth: 380, backgroundColor: "#FFFFFF", borderRadius: 20,
              padding: "28px 22px", border: "1px solid #DDEAFF",
              display: "flex", flexDirection: "column", alignItems: "center",
              boxShadow: "0 12px 24px rgba(26,42,74,0.2)", animation: "slideUp 300ms ease-out",
            }}
          >
            <div
              style={{
                width: 68, height: 68, borderRadius: 34,
                border: "2px solid #3D6FFF", backgroundColor: "rgba(61,111,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16, fontSize: 32,
              }}
            >
              ⚠
            </div>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#1A2A4A", marginBottom: 8 }}>
              Sair da partida?
            </span>
            <span style={{ color: "#5C6F8F", fontSize: 13, textAlign: "center", marginBottom: 22, padding: "0 8px" }}>
              Se voce recarregar a pagina, a partida sera encerrada e contara como derrota.
            </span>
            <div style={{ display: "flex", flexDirection: "row", gap: 10, width: "100%" }}>
              <button
                onClick={onDismissReloadWarning}
                style={{
                  flex: 1, padding: "13px 0", borderRadius: 12, backgroundColor: "#FFFFFF",
                  border: "1px solid #DDEAFF", color: "#1A2A4A", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                Continuar jogando
              </button>
              <button
                onClick={onConfirmReloadDefeat}
                style={{
                  flex: 1, padding: "13px 0", borderRadius: 12, backgroundColor: "#FF3D6F",
                  border: "none", color: "#FFFFFF", fontWeight: 900, fontSize: 14, cursor: "pointer",
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reload defeat modal */}
      {reloadDefeat && (
        <div
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(26, 42, 74, 0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, zIndex: 300, animation: "fadeIn 220ms ease-out",
          }}
        >
          <div
            style={{
              width: "100%", maxWidth: 380, backgroundColor: "#FFFFFF", borderRadius: 20,
              padding: "28px 22px", border: "1px solid #DDEAFF",
              display: "flex", flexDirection: "column", alignItems: "center",
              boxShadow: "0 12px 24px rgba(26,42,74,0.2)", animation: "slideUp 360ms ease-out",
            }}
          >
            <div
              style={{
                width: 84, height: 84, borderRadius: 42,
                border: "2px solid #FF3D6F", backgroundColor: "rgba(255,61,111,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16, fontSize: 40,
              }}
            >
              ✕
            </div>
            <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, color: "#FF3D6F" }}>
              Derrota
            </span>
            <span style={{ color: "#5C6F8F", fontSize: 13, textAlign: "center", marginBottom: 22, padding: "0 8px" }}>
              Voce abandonou a partida.
            </span>
            <button
              onClick={() => navigate("/")}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 12,
                background: "linear-gradient(to right, #3D6FFF, #6B9FFF)",
                border: "none", color: "#FFFFFF", fontWeight: 900, fontSize: 15,
                letterSpacing: 0.5, cursor: "pointer",
              }}
            >
              Voltar ao menu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
