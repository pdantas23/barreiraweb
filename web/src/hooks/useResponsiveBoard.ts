import { BOARD_SIZE } from "@barreira/shared";
import { useEffect, useState } from "react";

const BOARD_PADDING = 2;
const GAP = 5;
const WALL_THICKNESS = 6;
const MAX_BOARD = 600;

export type BoardLayout = {
  boardSize: number;
  squareSize: number;
  gap: number;
  padding: number;
  wallThickness: number;
  wallLength: number;
};

const calc = (): BoardLayout => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width < 768;
  const maxBoard = isMobile
    ? Math.min(width * 0.9, height * 0.8, MAX_BOARD)
    : Math.min(width, height * 0.5, MAX_BOARD);
  const boardSize = Math.floor(maxBoard);
  const inner = boardSize - BOARD_PADDING * 2 - GAP * (BOARD_SIZE - 1);
  const squareSize = Math.floor(inner / BOARD_SIZE);
  return {
    boardSize,
    squareSize,
    gap: GAP,
    padding: BOARD_PADDING,
    wallThickness: WALL_THICKNESS,
    wallLength: squareSize * 2 + GAP,
  };
};

export const useResponsiveBoard = (): BoardLayout => {
  const [layout, setLayout] = useState(calc);

  useEffect(() => {
    const onResize = () => setLayout(calc());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return layout;
};
