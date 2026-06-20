import {
  BOARD_SIZE,
  TOTAL_SQUARES,
  col,
  row,
  type GameState,
  type WallPlacement,
} from "@barreira/shared";
import type { ReactElement } from "react";
import { gc } from "../gameColors";
import type { BoardLayout } from "../hooks/useResponsiveBoard";
import { BlockedPathToast } from "./BlockedPathToast";
import { Piece } from "./Piece";
import { Square } from "./Square";
import { Wall } from "./Wall";

/** Skin custom por jogador (Replay Builder): bandeira no peão + cor da parede. */
export type PlayerSkin = {
  flagUrl?: string;
  wallColor?: string;
};

type Props = {
  state: GameState;
  validMoves: Set<number>;
  ghost: WallPlacement | null;
  ghostInvalid?: boolean;
  showBlockedToast?: boolean;
  onSquareTap: (index: number) => void;
  boardRef: React.RefObject<HTMLDivElement | null>;
  layout: BoardLayout;
  flipped?: boolean;
  /** Skins custom (opcional — só o Replay Builder usa hoje). */
  skins?: { 1?: PlayerSkin; 2?: PlayerSkin };
};

const piecePos = (index: number, layout: BoardLayout) => {
  const r = row(index);
  const c = col(index);
  const cellSize = layout.squareSize + layout.gap;
  return {
    left: layout.padding + c * cellSize + layout.squareSize / 2,
    top: layout.padding + r * cellSize + layout.squareSize / 2,
  };
};

export const Board = ({
  state,
  validMoves,
  ghost,
  ghostInvalid = false,
  showBlockedToast = false,
  onSquareTap,
  boardRef,
  layout,
  flipped = false,
  skins,
}: Props) => {

  const squares: ReactElement[] = [];
  for (let i = 0; i < TOTAL_SQUARES; i++) {
    const r = row(i);
    const c = col(i);
    const isAlt = (r + c) % 2 === 1;
    const isValidMove = validMoves.has(i);

    squares.push(
      <Square
        key={i}
        index={i}
        size={layout.squareSize}
        isAlt={isAlt}
        isHighlighted={isValidMove}
        onPress={isValidMove ? onSquareTap : undefined}
      />,
    );
  }

  const p1Pos = piecePos(state.p1, layout);
  const p2Pos = piecePos(state.p2, layout);

  const goalHeight = 10;

  return (
    <div style={{ boxShadow: `0 4px 20px ${gc.boardShadow}1f` }}>
      <div
        style={{
          width: layout.boardSize + 12,
          height: layout.boardSize + 12,
          borderRadius: gc.boardRadius,
          background: `linear-gradient(to bottom, ${gc.boardBg}, ${gc.boardBgEnd})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={boardRef}
          style={{
            width: layout.boardSize,
            height: layout.boardSize,
            padding: layout.padding,
            position: "relative",
          }}
        >
          {/* Goal zone opponent (top) */}
          <div
            style={{
              position: "absolute",
              top: layout.padding,
              left: layout.padding,
              right: layout.padding,
              height: goalHeight,
              borderTopLeftRadius: gc.cellRadius,
              borderTopRightRadius: gc.cellRadius,
              background: `linear-gradient(to right, ${gc.goalOpponent[0]}33, ${gc.goalOpponent[1]}33)`,
              zIndex: 5,
              pointerEvents: "none",
            }}
          />

          {/* Goal zone player (bottom) */}
          <div
            style={{
              position: "absolute",
              bottom: layout.padding,
              left: layout.padding,
              right: layout.padding,
              height: goalHeight,
              borderBottomLeftRadius: gc.cellRadius,
              borderBottomRightRadius: gc.cellRadius,
              background: `linear-gradient(to right, ${gc.goalPlayer[0]}33, ${gc.goalPlayer[1]}33)`,
              zIndex: 5,
              pointerEvents: "none",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: layout.gap, flex: 1, height: "100%" }}>
            {Array.from({ length: BOARD_SIZE }).map((_, r) => (
              <div key={r} style={{ display: "flex", flexDirection: "row", gap: layout.gap, flex: 1 }}>
                {squares.slice(r * BOARD_SIZE, (r + 1) * BOARD_SIZE)}
              </div>
            ))}
          </div>

          {/* Animated pieces */}
          <div
            style={{
              position: "absolute",
              left: p1Pos.left,
              top: p1Pos.top,
              transform: "translate(-50%, -50%)",
              zIndex: 15,
              transition: "left 200ms ease-out, top 200ms ease-out",
              pointerEvents: "none",
            }}
          >
            <Piece player={1} size={layout.squareSize} flagUrl={skins?.[1]?.flagUrl} />
          </div>
          <div
            style={{
              position: "absolute",
              left: p2Pos.left,
              top: p2Pos.top,
              transform: "translate(-50%, -50%)",
              zIndex: 15,
              transition: "left 200ms ease-out, top 200ms ease-out",
              pointerEvents: "none",
            }}
          >
            <Piece player={2} size={layout.squareSize} flagUrl={skins?.[2]?.flagUrl} />
          </div>

          {state.walls.placements.map((p) => (
            <Wall
              key={`${p.type}-${p.interRow}-${p.interCol}`}
              placement={p}
              layout={layout}
              colorOverride={skins?.[(p.owner ?? 1) as 1 | 2]?.wallColor}
            />
          ))}
          {ghost && <Wall placement={ghost} layout={layout} ghost ghostInvalid={ghostInvalid} />}

          <BlockedPathToast
            visible={showBlockedToast}
            position={ghost && ghost.interRow < 4 ? "bottom" : "top"}
            flipped={flipped}
          />
        </div>
      </div>
    </div>
  );
};
