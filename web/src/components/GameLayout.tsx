import { IoChevronBack } from "react-icons/io5";
import type { ReactNode, RefObject } from "react";
import type { GameState, PlayerId, WallPlacement, WallType } from "@barreira/shared";
import { WALLS_PER_PLAYER } from "@barreira/shared";
import { Board } from "./Board";
import { GameTimer } from "./GameTimer";
import { PlayerCard, TurnArrow } from "./PlayerCard";
import { WallBank } from "./WallBank";
import { gc } from "../gameColors";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

export interface GameLayoutProps {
  state: GameState;
  myPlayer: PlayerId;
  opponentPlayer: PlayerId;
  myName: string;
  opponentName: string;
  myTimeMs: number;
  opTimeMs: number;
  countdownActive: boolean;
  validMoves: Set<number>;
  ghost: WallPlacement | null;
  ghostInvalid: boolean;
  showBlockedToast: boolean;
  boardRef: RefObject<HTMLDivElement | null>;
  layout: BoardLayout;
  flipped?: boolean;
  dragX: React.MutableRefObject<number>;
  dragY: React.MutableRefObject<number>;
  lastInter: React.MutableRefObject<string>;
  myTurn: boolean;
  wallsDisabled: boolean;
  onSquareTap: (index: number) => void;
  onDragStart: (type: WallType) => void;
  onIntersectionChange: (ir: number, ic: number, type: WallType) => void;
  onIntersectionLeave: () => void;
  onDragEnd: () => void;
  onBack: () => void;
  topBarBadge: ReactNode;
  topBarRight?: ReactNode;
  children?: ReactNode;
}

export function GameLayout({
  state,
  myPlayer,
  opponentPlayer,
  myName,
  opponentName,
  myTimeMs,
  opTimeMs,
  countdownActive,
  validMoves,
  ghost,
  ghostInvalid,
  showBlockedToast,
  boardRef,
  layout,
  flipped = false,
  dragX,
  dragY,
  lastInter,
  myTurn,
  wallsDisabled,
  onSquareTap,
  onDragStart,
  onIntersectionChange,
  onIntersectionLeave,
  onDragEnd,
  onBack,
  topBarBadge,
  topBarRight,
  children,
}: GameLayoutProps) {
  return (
    <div
      style={{
        height: "100%",
        background: `linear-gradient(to bottom, ${gc.bgTop}, ${gc.bgBottom})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0 8px",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "0 16px", marginBottom: 4 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer" }}>
          <IoChevronBack size={24} color={gc.textDark} />
        </button>
        {topBarBadge}
        {topBarRight ?? <div style={{ width: 36 }} />}
      </div>

      {/* TODO: integrar SDK de anúncios — banner superior (mobile 320x50/320x100, desktop 728x90) */}
      <div className="w-full flex-shrink-0 flex bg-[#F5F5F5] border-[1.5px] border-dashed border-[#BBBBBB] items-center justify-center h-[100px] md:h-[90px]">
        <span className="text-[10px] text-[#BBBBBB]">Anúncio</span>
      </div>

      {/* Main */}
      <section className="main w-full h-full flex flex-row items-stretch">
        {/* Left ad placeholder - desktop only (300x250 / 300x600) */}
        <div className="hidden md:flex w-[320px] flex-shrink-0 mr-3 items-center justify-center border-[1.5px] border-dashed border-[#BBBBBB] bg-[#F5F5F5]">
          <span className="text-[10px] text-[#BBBBBB]">Anúncio</span>
        </div>

        {/* Center content */}
        <div className="w-[90%] mx-auto md:flex-1 flex flex-col items-center mt-2">
          {/* Player cards */}
          <div className="flex flex-row items-center w-full gap-1 mb-1.5">
            <PlayerCard name={opponentName} wallsLeft={state.wallsLeft[opponentPlayer]} totalWalls={WALLS_PER_PLAYER} isActive={state.turn === opponentPlayer && state.winner === null} isPlayer={false} />
            <TurnArrow isPlayerTurn={state.turn === myPlayer} />
            <PlayerCard name={myName} wallsLeft={state.wallsLeft[myPlayer]} totalWalls={WALLS_PER_PLAYER} isActive={state.turn === myPlayer && state.winner === null} isPlayer={true} />
          </div>

          {/* Opponent timer */}
          <div className="w-full m-[3px]">
            <GameTimer timeRemainingMs={opTimeMs} isActive={state.turn === opponentPlayer && state.winner === null && !countdownActive} isPlayer={false} />
          </div>

          {/* Board */}
          <div className="flex-1 flex justify-center items-center">
            <div style={flipped ? { transform: "rotate(180deg)" } : undefined}>
              <Board state={state} validMoves={validMoves} ghost={ghost} ghostInvalid={ghostInvalid} showBlockedToast={showBlockedToast} onSquareTap={onSquareTap} boardRef={boardRef} layout={layout} />
            </div>
          </div>

          {/* Player timer */}
          <div className="w-full m-[3px]">
            <GameTimer timeRemainingMs={myTimeMs} isActive={state.turn === myPlayer && state.winner === null && !countdownActive} isPlayer={true} />
          </div>

          {/* Wall bank */}
          <WallBank
            wallsLeft={state.wallsLeft[myPlayer]}
            disabled={wallsDisabled}
            dragX={dragX}
            dragY={dragY}
            lastInter={lastInter}
            boardRef={boardRef}
            layout={layout}
            flipped={flipped}
            onDragStart={onDragStart}
            onIntersectionChange={onIntersectionChange}
            onIntersectionLeave={onIntersectionLeave}
            onDragEnd={onDragEnd}
          />

          <span style={{ color: gc.labelColor, fontSize: 11, textAlign: "center", padding: "0 16px", margin: "8px 0" }}>
            Toque para mover - Arraste para colocar parede
          </span>
        </div>

        {/* Right ad placeholder - desktop only (300x250 / 300x600) */}
        <div className="hidden md:flex w-[320px] flex-shrink-0 ml-3 items-center justify-center border-[1.5px] border-dashed border-[#BBBBBB] bg-[#F5F5F5]">
          <span className="text-[10px] text-[#BBBBBB]">Anúncio</span>
        </div>
      </section>

      {/* Overlays (modals, countdowns, banners) */}
      {children}
    </div>
  );
}

