import { useEffect, useRef } from "react";
import type { WallType } from "@barreira/shared";
import { theme } from "../theme";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

type Props = {
  type: WallType;
  dragX: React.MutableRefObject<number>;
  dragY: React.MutableRefObject<number>;
  layout: BoardLayout;
};

export const DragLayer = ({ type, dragX, dragY, layout }: Props) => {
  const isH = type === "h";
  const w = isH ? layout.squareSize * 2 + layout.gap : layout.wallThickness;
  const h = isH ? layout.wallThickness : layout.squareSize * 2 + layout.gap;
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const update = () => {
      if (ref.current) {
        ref.current.style.transform = `translate(${dragX.current - w / 2}px, ${dragY.current - h / 2}px)`;
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dragX, dragY, w, h]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: w,
        height: h,
        backgroundColor: theme.player1,
        opacity: 0.75,
        borderRadius: 4,
        boxShadow: `0 0 12px ${theme.player1}b3`,
        pointerEvents: "none",
        zIndex: 1000,
        willChange: "transform",
      }}
    />
  );
};
