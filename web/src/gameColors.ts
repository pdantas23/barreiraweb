// Paleta exclusiva da tela de partida.
// Nenhuma outra tela importa daqui — menu, lobby, etc. continuam com theme.ts.

export const gc = {
  // Fundo gradiente
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",

  // Tabuleiro card
  boardBg: "#FFFFFF",
  boardBgEnd: "#F5F7FF",
  boardShadow: "#3D6FFF",
  boardRadius: 16,

  // Células
  cell: "#EEF2FF",
  cellBorder: "#DDEAFF",
  cellRadius: 8,

  // Valid moves
  validMoveBg: "rgba(61,111,255,0.12)",
  validMoveBorder: "#3D6FFF",

  // Goal zones
  goalPlayer: ["#3D6FFF", "#6B9FFF"] as const,
  goalOpponent: ["#FF3D6F", "#FF6B9F"] as const,
  goalOpacity: 0.2,

  // Peões
  pawnPlayer: ["#3D6FFF", "#6B9FFF"] as const,
  pawnOpponent: ["#FF3D6F", "#FF6B9F"] as const,
  pawnOuter: "#FFFFFF",
  pawnReflect: "rgba(255,255,255,0.3)",

  // Accent
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  red: "#FF3D6F",
  redLight: "#FF6B9F",

  // HUD
  hudBg: "rgba(255,255,255,0.95)",
  hudDivider: "rgba(61,111,255,0.10)",
  labelColor: "#9AAACA",

  // Paredes (pills)
  wallActive: "rgba(61,111,255,0.85)",
  wallUsed: "rgba(61,111,255,0.10)",

  // Timer
  timerBarBg: "#EEF2FF",
  timerBarFill: ["#3D6FFF", "#6B9FFF"] as const,
  timerBarDanger: "#FF3D6F",

  // Player cards
  cardBg: "#FFFFFF",
  cardActiveBg: "#3D6FFF",
  cardActiveText: "#FFFFFF",
  cardBorderPlayer: ["#3D6FFF", "#6B9FFF"] as const,
  cardBorderOpponent: ["#FF3D6F", "#FF6B9F"] as const,

  // Texto
  textDark: "#2A3550",
  textMuted: "#9AAACA",
  white: "#FFFFFF",
} as const;
