import { IoExitOutline } from "react-icons/io5";
import { ConfirmModal } from "../components/ConfirmModal";
import { GameLayout } from "../components/GameLayout";
import { GameOverlays } from "../components/GameOverlays";
import { PageGate } from "../components/PageGate";
import { gc } from "../gameColors";
import { difficultyLabel, useLocalGame } from "../hooks/useLocalGame";

export default function GameScreen() {
  const game = useLocalGame();

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
          <span style={{ color: gc.blue, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>{difficultyLabel(game.difficulty)}</span>
        </div>
      }
    >
      <GameOverlays
        countdownActive={game.countdownActive}
        countdownStartsAt={game.countdownStartsAt}
        onCountdownComplete={() => game.setCountdownActive(false)}
        winner={game.state.winner}
        reloadDefeat={game.reloadDefeat}
        gameOverReason={game.gameOverReason}
        onRematch={game.onRestart}
        showReloadWarning={game.showReloadWarning}
        onDismissReloadWarning={() => game.setShowReloadWarning(false)}
        onConfirmReloadDefeat={game.confirmReloadDefeat}
      />

      <ConfirmModal
        visible={game.showQuitConfirm}
        variant="danger"
        title="Sair da partida?"
        message="Tem certeza que deseja sair? O progresso da partida sera perdido."
        cancelLabel="Continuar jogando"
        confirmLabel="Sair"
        icon={<IoExitOutline size={36} color="#FF3D6F" />}
        onCancel={game.cancelQuit}
        onConfirm={game.confirmQuit}
      />
    </GameLayout>
    </PageGate>
  );
}
