// Validação de payloads vindos do socket (untrusted). Os handlers chamam
// estas funções ANTES de processar — campos ausentes, tipos errados ou
// strings gigantes são rejeitados com LobbyError("invalid-payload") sem
// chegar no engine/DB. Validação simples e inline, sem dependências externas.

import { LobbyError } from "./lobby.js";

// Limites de tamanho dos campos de texto.
const MAX_NAME = 30;
const MAX_CODE = 10;
const MAX_PASSWORD = 50;

// Tabuleiro 9x9: casas 0..80; intersecções de parede 0..7 (BOARD_SIZE-2).
const TOTAL_SQUARES = 81;
const MAX_INTER = 7;

const VALID_COLORS = new Set(["cyan", "random", "red"]);

const fail = (): never => {
  throw new LobbyError("invalid-payload");
};

// Garante que o valor é um objeto e devolve como Record pra inspeção dos
// campos. Lança invalid-payload se não for objeto.
const asObj = (v: unknown): Record<string, unknown> => {
  if (typeof v !== "object" || v === null) fail();
  return v as Record<string, unknown>;
};

const isNonEmptyStr = (v: unknown, max: number): boolean =>
  typeof v === "string" && v.length > 0 && v.length <= max;

const isInt = (v: unknown): v is number => Number.isInteger(v);

// Exige inteiro dentro de [min, max]; lança invalid-payload caso contrário.
const requireIntInRange = (v: unknown, min: number, max: number): void => {
  if (!isInt(v) || v < min || v > max) fail();
};

export const validateCreateRoom = (p: unknown): void => {
  const o = asObj(p);
  if (!isNonEmptyStr(o.hostName, MAX_NAME)) fail();
  if (typeof o.color !== "string" || !VALID_COLORS.has(o.color)) fail();
  if (typeof o.isPrivate !== "boolean") fail();
};

export const validateJoinRoom = (p: unknown): void => {
  const o = asObj(p);
  if (!isNonEmptyStr(o.code, MAX_CODE)) fail();
  if (!isNonEmptyStr(o.playerName, MAX_NAME)) fail();
  if (
    o.password !== undefined &&
    (typeof o.password !== "string" || o.password.length > MAX_PASSWORD)
  ) {
    fail();
  }
};

export const validateListRooms = (p: unknown): void => {
  // Sem campos obrigatórios; só rejeita um payload primitivo (ex: string
  // gigante) onde deveria vir um objeto vazio.
  if (p !== undefined && p !== null && typeof p !== "object") fail();
};

// === Sistema de amizade ===

const MAX_USERNAME = 30;
const MAX_TOKEN = 200;
const VALID_PLATFORMS = new Set(["ios", "android"]);

export const validateSendFriendRequest = (p: unknown): void => {
  const o = asObj(p);
  if (!isNonEmptyStr(o.targetUsername, MAX_USERNAME)) fail();
};

export const validateRespondFriendRequest = (p: unknown): void => {
  const o = asObj(p);
  if (!isNonEmptyStr(o.requesterUsername, MAX_USERNAME)) fail();
};

export const validateRemoveFriend = (p: unknown): void => {
  const o = asObj(p);
  if (!isNonEmptyStr(o.targetUsername, MAX_USERNAME)) fail();
};

export const validateGetFriends = (p: unknown): void => {
  if (p !== undefined && p !== null && typeof p !== "object") fail();
};

export const validateSendGameInvite = (p: unknown): void => {
  const o = asObj(p);
  if (!isNonEmptyStr(o.targetUsername, MAX_USERNAME)) fail();
};

export const validateRespondGameInvite = (p: unknown): void => {
  const o = asObj(p);
  if (!isNonEmptyStr(o.fromUsername, MAX_USERNAME)) fail();
  if (typeof o.accept !== "boolean") fail();
};

// Tokens de link de amizade são gerados pelo server (hex), mas validamos
// tamanho/forma do que volta do cliente mesmo assim.
const MAX_INVITE_TOKEN = 100;

export const validateRedeemFriendInvite = (p: unknown): void => {
  const o = asObj(p);
  if (!isNonEmptyStr(o.token, MAX_INVITE_TOKEN)) fail();
};

export const validateRegisterPushToken = (p: unknown): void => {
  const o = asObj(p);
  if (!isNonEmptyStr(o.token, MAX_TOKEN)) fail();
  if (typeof o.platform !== "string" || !VALID_PLATFORMS.has(o.platform)) fail();
};

export const validateMove = (p: unknown): void => {
  const o = asObj(p);
  const move = asObj(o.move);

  if (move.kind === "piece") {
    requireIntInRange(move.to, 0, TOTAL_SQUARES - 1);
  } else if (move.kind === "wall") {
    const placement = asObj(move.placement);
    if (placement.type !== "h" && placement.type !== "v") fail();
    requireIntInRange(placement.interRow, 0, MAX_INTER);
    requireIntInRange(placement.interCol, 0, MAX_INTER);
  } else {
    fail();
  }
};
