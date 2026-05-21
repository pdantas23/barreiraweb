// Barrel do pacote @barreira/shared.
// Mobile e server importam tudo daqui — nunca de subcaminhos —
// pra a gente poder reorganizar internamente sem quebrar consumidores.

// --- Engine pura ---
export * from "./types";
export * from "./board";
export * from "./walls";
export * from "./moves";
export * from "./engine";

// --- Bots ---
export { easyOpponentMove } from "./easyOpponent";
export { smartOpponentMove } from "./smartOpponent";
export { minimaxOpponentMove } from "./minimaxOpponent";
export { randomOpponentMove } from "./randomOpponent";

// --- Serialização (wire format) ---
export * from "./serialization";
