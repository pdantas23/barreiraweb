import { useCallback, useRef } from "react";
import { BOARD_SIZE, WALLS_PER_PLAYER, type WallType } from "@barreira/shared";
import { gc } from "../gameColors";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

type Props = {
  wallsLeft: number;
  disabled?: boolean;
  dragX: React.MutableRefObject<number>;
  dragY: React.MutableRefObject<number>;
  lastInter: React.MutableRefObject<string>;
  boardRef: React.RefObject<HTMLDivElement | null>;
  layout: BoardLayout;
  flipped?: boolean;
  onDragStart: (type: WallType) => void;
  onIntersectionChange: (ir: number, ic: number, type: WallType) => void;
  onIntersectionLeave: () => void;
  onDragEnd: () => void;
};

export const WallBank = ({
  wallsLeft,
  disabled,
  dragX,
  dragY,
  lastInter,
  boardRef,
  layout,
  flipped,
  onDragStart,
  onIntersectionChange,
  onIntersectionLeave,
  onDragEnd,
}: Props) => {
  const dim = !!disabled || wallsLeft <= 0;
  const { squareSize, gap, padding, wallThickness } = layout;
  const cellSize = squareSize + gap;
  const dragTypeRef = useRef<WallType | null>(null);

  const handlePointerDown = useCallback(
    (type: WallType, e: React.PointerEvent) => {
      if (dim) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragTypeRef.current = type;
      dragX.current = e.clientX;
      dragY.current = e.clientY;
      lastInter.current = "__none__";
      onDragStart(type);

      const onMove = (ev: PointerEvent) => {
        dragX.current = ev.clientX;
        dragY.current = ev.clientY;

        const board = boardRef.current;
        if (!board) return;
        const rect = board.getBoundingClientRect();

        const localX = ev.clientX - rect.left - padding;
        const localY = ev.clientY - rect.top - padding;

        const outside =
          localX < -cellSize ||
          localY < -cellSize ||
          localX > BOARD_SIZE * cellSize ||
          localY > BOARD_SIZE * cellSize;

        const innerSize = BOARD_SIZE * cellSize;
        const adjX = flipped ? innerSize - localX : localX;
        const adjY = flipped ? innerSize - localY : localY;

        let key: string;
        let ir = 0;
        let ic = 0;
        if (outside) {
          key = "OUT";
        } else {
          ic = Math.max(
            0,
            Math.min(BOARD_SIZE - 2, Math.round((adjX + gap / 2) / cellSize) - 1),
          );
          ir = Math.max(
            0,
            Math.min(BOARD_SIZE - 2, Math.round((adjY + gap / 2) / cellSize) - 1),
          );
          key = `${ir}-${ic}`;
        }

        if (key !== lastInter.current) {
          lastInter.current = key;
          if (outside) onIntersectionLeave();
          else onIntersectionChange(ir, ic, type);
        }
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        dragTypeRef.current = null;
        onDragEnd();
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [dim, dragX, dragY, lastInter, boardRef, layout, flipped, onDragStart, onIntersectionChange, onIntersectionLeave, onDragEnd, cellSize, gap, padding],
  );

  const wallLen = squareSize * 2 + gap;
  const wallThick = wallThickness;

  return (
    <div
      className="w-[90%] md:w-[40%]"
      style={{
        backgroundColor: gc.hudBg,
        borderTop: `1px solid ${gc.hudDivider}`,
        padding: "2px 8px",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 600, color: gc.labelColor, letterSpacing: 2 }}>
        SUAS PAREDES
      </span>

      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
        {/* Counter card */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            border: `1.5px solid ${gc.blue}66`,
            backgroundColor: gc.cell,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: gc.blue }}>{wallsLeft}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "row", gap: 10, alignItems: "center" }}>
          {/* H template */}
          <div
            onPointerDown={(e) => handlePointerDown("h", e)}
            style={{
              padding: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              cursor: dim ? "default" : "grab",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            <div
              style={{
                width: wallLen,
                height: wallThick,
                borderRadius: 3,
                backgroundColor: gc.wallActive,
                opacity: dim ? 0.1 : 1,
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 700, color: gc.labelColor, letterSpacing: 1 }}>H</span>
          </div>

          {/* V template */}
          <div
            onPointerDown={(e) => handlePointerDown("v", e)}
            style={{
              padding: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              cursor: dim ? "default" : "grab",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            <div
              style={{
                width: wallThick,
                height: wallLen,
                borderRadius: 3,
                backgroundColor: gc.wallActive,
                opacity: dim ? 0.1 : 1,
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 700, color: gc.labelColor, letterSpacing: 1 }}>V</span>
          </div>
        </div>
      </div>
    </div>
  );
};

type OpponentWallBankProps = {
  wallsLeft: number;
};

export const OpponentWallBank = ({ wallsLeft }: OpponentWallBankProps) => {
  return (
    <div
      style={{
        width: "90%",
        padding: "5px 14px",
        borderRadius: 10,
        backgroundColor: gc.hudBg,
        border: `1px solid ${gc.hudDivider}`,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 600, color: gc.labelColor, letterSpacing: 1.5 }}>
        PAREDES OPONENTE
      </span>
      <div style={{ display: "flex", flexDirection: "row", gap: 3 }}>
        {Array.from({ length: WALLS_PER_PLAYER }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 14,
              height: 5,
              borderRadius: 3,
              backgroundColor: i < wallsLeft ? `${gc.red}d9` : `${gc.red}1a`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
