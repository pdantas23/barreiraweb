import { IoAlertCircle, IoChevronBack, IoFlagOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { GameLayout } from "../components/GameLayout";
import { GameOverModal } from "../components/GameOverModal";
import { PageGate } from "../components/PageGate";
import { gc } from "../gameColors";
import { useOnlineGame } from "../hooks/useOnlineGame";
import { theme } from "../theme";

const L = {
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  border: "#DDEAFF",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
};

export default function OnlineGameScreen() {
  const game = useOnlineGame();
  const navigate = useNavigate();

  // Waiting screen (before game starts)
  if (!game.ready) {
    return (
      <PageGate>
      <div
        style={{
          height: "100%",
          background: `linear-gradient(to bottom, ${L.bgTop}, ${L.bgBottom})`,
          display: "flex",
          flexDirection: "column",
          padding: "10px 0 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px" }}>
          <button onClick={game.onBack} style={{ width: 40, height: 40, display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}>
            <IoChevronBack size={28} color={L.navy} />
          </button>
          <span style={{ flex: 1, color: L.navy, fontSize: 18, fontWeight: 800, letterSpacing: 0.5, textAlign: "center" }}>Sala {game.code}</span>
          <div style={{ width: 40 }} />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${theme.player1}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 20 }} />
          <span style={{ color: L.navy, fontSize: 18, fontWeight: 800 }}>
            {game.isHost ? "Aguardando oponente..." : "Entrando..."}
          </span>
          {game.isHost && (
            <>
              <span style={{ color: L.muted, fontSize: 12, marginTop: 18, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Compartilhe esse codigo para alguem entrar:
              </span>
              <div style={{ marginTop: 8, padding: "14px 28px", borderRadius: 14, backgroundColor: L.white, border: `1px solid ${L.border}`, boxShadow: `0 4px 12px ${L.navy}14` }}>
                <span style={{ color: theme.player1, fontSize: 30, fontWeight: 900, letterSpacing: 8, fontVariantNumeric: "tabular-nums" }}>{game.code}</span>
              </div>
              {game.password && (
                <>
                  <span style={{ color: L.muted, fontSize: 12, marginTop: 18, letterSpacing: 0.5, textTransform: "uppercase" }}>
                    Senha (sala privada):
                  </span>
                  <div style={{ marginTop: 8, padding: "14px 28px", borderRadius: 14, backgroundColor: L.white, border: `1px solid ${L.border}`, boxShadow: `0 4px 12px ${L.navy}14` }}>
                    <span style={{ color: theme.player2, fontSize: 30, fontWeight: 900, letterSpacing: 8, fontVariantNumeric: "tabular-nums" }}>{game.password}</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
      </PageGate>
    );
  }

  return (
    <PageGate>
    <GameLayout
      state={game.state}
      myPlayer={game.myPlayer}
      opponentPlayer={game.opponentPlayer}
      myName={game.myName}
      opponentName={game.opponentName}
      myTimeMs={game.myTimeMs}
      opTimeMs={game.opTimeMs}
      countdownActive={game.countdownActive}
      validMoves={game.validMoves}
      ghost={game.ghost}
      ghostInvalid={game.ghostInvalid}
      showBlockedToast={game.showBlockedToast}
      boardRef={game.boardRef}
      layout={game.layout}
      flipped={game.flipped}
      dragX={game.dragX}
      dragY={game.dragY}
      lastInter={game.lastInter}
      myTurn={game.myTurn}
      wallsDisabled={game.wallsDisabled}
      onSquareTap={game.onSquareTap}
      onDragStart={game.onDragStart}
      onIntersectionChange={game.onIntersectionChange}
      onIntersectionLeave={game.onIntersectionLeave}
      onDragEnd={game.onDragEnd}
      onBack={game.onBack}
      topBarBadge={
        <div style={{ padding: "4px 12px", borderRadius: 12, backgroundColor: "rgba(61,111,255,0.08)" }}>
          <span style={{ color: gc.blue, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            vs {game.opponentName}
          </span>
        </div>
      }
      topBarRight={
        <button onClick={game.onReportPlayer} style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer" }}>
          <IoFlagOutline size={18} color={L.muted} />
        </button>
      }
    >
      {/* Countdown */}
      {game.countdownActive && game.countdownStartsAt !== null && (
        <CountdownOverlay startsAt={game.countdownStartsAt} onComplete={() => game.setCountdownActive(false)} />
      )}

      {/* Reconnecting banner */}
      {game.reconnecting && !game.opponentLeft && game.state.winner === null && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: L.white, borderRadius: 10, padding: "10px 14px", margin: "14px 16px 0", border: `1px solid ${theme.player1}`, boxShadow: `0 2px 8px ${L.navy}14` }}>
          <div style={{ width: 16, height: 16, border: `2px solid ${theme.player1}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: L.navy, fontSize: 12, fontWeight: 600, flex: 1 }}>
            Reconectando... sua vaga esta reservada por uns segundos.
          </span>
        </div>
      )}

      {/* Opponent left banner */}
      {game.opponentLeft && game.state.winner === null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: L.white, borderRadius: 10, padding: "10px 14px", margin: "14px 16px 0", border: `1px solid ${theme.player2}`, boxShadow: `0 2px 8px ${L.navy}14` }}>
          <IoAlertCircle size={18} color={theme.player2} />
          <span style={{ color: theme.player2, fontSize: 13, fontWeight: 700 }}>Oponente saiu da partida</span>
        </div>
      )}

      {/* Game over modal */}
      <GameOverModal
        visible={game.state.winner !== null && !game.reloadDefeat}
        winner={game.state.winner === null ? null : game.state.winner === game.myPlayer ? 1 : 2}
        reason={game.gameOverReason}
        onRematch={game.onRequestRematch}
        onBackToMenu={game.onBackToMenu}
        online
        rematchStatus={game.rematchStatus}
        rematchExpiresAt={game.rematchExpiresAt}
        rematchRequesterName={game.rematchRequesterName}
        onAcceptRematch={game.onAcceptRematch}
        onDeclineRematch={game.onDeclineRematch}
        onLeave={game.onBackToLobby}
      />

      {/* Opponent left game over */}
      {game.opponentLeft && game.state.winner === null && !game.reloadDefeat && (
        <GameOverModal
          visible={true}
          winner={2}
          onRematch={game.onBackToLobby}
          onBackToMenu={game.onBackToMenu}
        />
      )}

      {/* Reload warning modal */}
      {game.showReloadWarning && !game.reloadDefeat && (
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
              Se voce recarregar a pagina, a partida sera encerrada e o oponente vencera automaticamente.
            </span>
            <div style={{ display: "flex", flexDirection: "row", gap: 10, width: "100%" }}>
              <button
                onClick={() => game.setShowReloadWarning(false)}
                style={{
                  flex: 1, padding: "13px 0", borderRadius: 12, backgroundColor: "#FFFFFF",
                  border: "1px solid #DDEAFF", color: "#1A2A4A", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                Continuar jogando
              </button>
              <button
                onClick={game.confirmReloadDefeat}
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
      {game.reloadDefeat && (
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
              Voce abandonou a partida online. O oponente vence automaticamente.
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
    </GameLayout>
    </PageGate>
  );
}
