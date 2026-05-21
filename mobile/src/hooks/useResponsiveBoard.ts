import { useWindowDimensions } from "react-native";
import { BOARD_SIZE } from "../game/board";

const BOARD_PADDING = 2;
const GAP = 5;
const WALL_THICKNESS = 6;

export type BoardLayout = {
  boardSize: number;
  squareSize: number;
  gap: number;
  padding: number;
  wallThickness: number;
  // Comprimento total da parede dupla = 2 casas + o gap entre elas.
  // Mesma dimensão usada tanto pelo Wall no tabuleiro quanto pela paredinha
  // visual no WallBank. Fonte única de verdade.
  wallLength: number;
};

export const useResponsiveBoard = (): BoardLayout => {
  const { width, height } = useWindowDimensions();
  const maxBoard = Math.min(width, height * 0.78);
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
