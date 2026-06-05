// Barrel do pacote @barreira/shared.
// Mobile e server importam tudo daqui — nunca de subcaminhos —
// pra a gente poder reorganizar internamente sem quebrar consumidores.

// --- Engine pura ---
export * from "./types";
export * from "./board";
export * from "./walls";
export * from "./moves";
export * from "./engine";

// --- Bot (3 dificuldades: easy | medium | hard) ---
export { botMove } from "./bot";
export type { BotDifficulty } from "./bot";

// --- Nomes realistas pra bots ---
export { BOT_NAMES, getRandomBotName } from "./botNames";

// --- Serialização (wire format) ---
export * from "./serialization";

// --- Protocolo cliente ↔ server ---
export * from "./protocol";
