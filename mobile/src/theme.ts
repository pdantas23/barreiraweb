import { Dimensions } from 'react-native';

// ==========================================
// 1. TAMANHOS E DIMENSÕES DO TABULEIRO
// ==========================================
const { width } = Dimensions.get('window');

export const BOARD_PADDING = 10;
const AVAILABLE_WIDTH = width - BOARD_PADDING * 2;
export const BOARD_SIZE = 9; // Tabuleiro 9x9
export const CELL_SIZE = Math.floor(AVAILABLE_WIDTH / BOARD_SIZE);

// A "grossura" da parede
export const WALL_THICKNESS = 6; 
// O comprimento da parede (ocupa 2 casas + a grossura)
export const WALL_LENGTH = CELL_SIZE * 2 + WALL_THICKNESS; 


// ==========================================
// 2. PALETA DE CORES (Seu código original)
// ==========================================
// Paleta do inicial.html (matte azul / sombrio)
export const theme = {
  bg: "#121216",
  boardBg: "#1a1a20",
  boardBorder: "#2a2a35",
  square: "#e8e8e8",
  squareAlt: "#1a1a1a",
  validMove: "#2e4a3b",
  wallTarget: "#2a3a5c",
  wall: "#22569e",
  wallHighlight: "#3a7bd5",
  wallGhost: "rgba(34, 86, 158, 0.4)",
  textPrimary: "#eeeeee",
  textMuted: "#9aa0a6",
  player1: "#00f2fe",
  player2: "#ff5577",
  selected: "#ffd400",
} as const;