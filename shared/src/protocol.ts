// === Protocolo Barreira (cliente ↔ server) ===
//
// Único source-of-truth dos eventos. Mobile e server importam DAQUI.
// Quando precisar adicionar um evento novo, fazer aqui primeiro —
// o compilador então força você a tratar dos dois lados.

import type { SerializedGameState } from "./serialization";
import type { Move, PlayerId } from "./types";

// === Cores ===

// Cor "lógica" enviada pelo cliente ao criar sala. "random" vira
// "cyan" ou "red" no servidor no momento que a sala fica cheia.
export type ColorChoice = "cyan" | "random" | "red";

// Cor "resolvida" — o que cada jogador efetivamente recebe.
export type Color = "cyan" | "red";

// === Forma das salas ===

// Visão pública (vai na lista, sem senha).
export type PublicRoom = {
  code: string;
  hostName: string;
  hostColor: ColorChoice;
  isPrivate: boolean;
  playerCount: 1 | 2;
};

// Versão completa devolvida ao criador/entrante. Inclui senha (só
// faz sentido pro host enxergar e compartilhar com convidado).
export type RoomDetail = PublicRoom & {
  password: string | null;
};

// === RPC: cliente → server (sempre com ack tipado) ===

export type CreateRoomPayload = {
  hostName: string;
  color: ColorChoice;
  isPrivate: boolean;
};

export type JoinRoomPayload = {
  code: string;
  playerName: string;
  password?: string;
};

export type ListRoomsPayload = Record<string, never>;
export type LeaveRoomPayload = Record<string, never>;

export type MovePayload = {
  move: Move;
};

// Cliente avisa que o relógio de um jogador estourou. Sem payload: o server
// é a fonte da verdade — ele consulta o próprio relógio e só encerra (e
// premia) se confirmar o estouro. Assim um cliente não consegue forjar
// vitória por tempo.
export type ReportTimeoutPayload = Record<string, never>;

// === Push: server → cliente ===

export type GameStartPayload = {
  state: SerializedGameState;
  // Qual peça da engine você controla (1 ou 2). 1 sai de baixo, 2 sai de cima.
  // No cliente, quem é engine player 2 renderiza o tabuleiro invertido pra
  // sempre se ver saindo de baixo (decisão UX).
  yourEnginePlayer: PlayerId;
  yourColor: Color;
  opponentName: string;
  opponentColor: Color;
  // Timestamp (ms) a partir do qual o countdown de 3s começa.
  // Ambos os clientes calculam o restante com base nesse valor.
  countdownStartsAt: number;
  // Tempo total por jogador na partida (Fischer clock). Server é a fonte da
  // verdade — sem isso, web e mobile podem dessincronizar se uma versão
  // deployada tiver hardcoded diferente. Opcional pra retrocompat com client
  // antigo (que cai pra constante local GAME_TIME_TOTAL_MS).
  timeTotalMs?: number;
};

export type StateUpdatePayload = {
  state: SerializedGameState;
  // Move que produziu este state. Opcional pra retrocompatibilidade com
  // clientes antigos; usado pelo replay in-memory pra empilhar a sequência
  // de moves do oponente (que o client não envia, só recebe state).
  move?: Move;
};

export type GameOverPayload = {
  winner: PlayerId;
  // Por que a partida acabou. Opcional pra retrocompat com client antigo
  // (que cai pro motivo local). "goal" = chegou na linha; "timeout" = relógio
  // estourou; "abandon" = oponente saiu/caiu (W.O.).
  reason?: "goal" | "timeout" | "abandon";
};

export type MoveRejectedPayload = {
  error: string;
};

// === Rematch ===

export type RequestRematchPayload = Record<string, never>;
export type RespondRematchPayload = { accept: boolean };

export type RematchRequestedPayload = {
  fromName: string;
  expiresAt: number; // timestamp ms
};

export type RematchDeclinedPayload = Record<string, never>;
export type RematchExpiredPayload = Record<string, never>;

// === Profile (identidade persistente anônima) ===
// Emitido pelo server logo após connect/reanchor, ANTES de qualquer
// gameStart. Cliente guarda em estado global pra mostrar em todas as telas.
export type ProfilePayload = {
  clientId: string;
  displayName: string; // ex: "anonimo276"
};

// === RPC error envelope ===

// Lista de erros conhecidos — qualquer outro vira "internal-error".
// Manter como união força que cliente trate todos exhaustivamente.
export type RpcError =
  | "room-not-found"
  | "room-full"
  | "wrong-password"
  | "already-in-room"
  | "not-in-room"
  | "not-your-turn"
  | "invalid-move"
  | "game-over"
  | "game-not-over"
  | "rematch-already-pending"
  | "no-rematch-pending"
  | "self-match"
  | "invalid-payload"
  | "internal-error";

export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RpcError; message?: string };

// === Mapas de eventos (pra typed socket.io) ===

// Assinaturas com ack como ÚLTIMO parâmetro — convenção do socket.io.
export type ClientToServerEvents = {
  createRoom: (
    payload: CreateRoomPayload,
    ack: (res: RpcResult<RoomDetail>) => void,
  ) => void;
  joinRoom: (
    payload: JoinRoomPayload,
    ack: (res: RpcResult<RoomDetail>) => void,
  ) => void;
  listRooms: (
    payload: ListRoomsPayload,
    ack: (res: RpcResult<{ rooms: PublicRoom[] }>) => void,
  ) => void;
  leaveRoom: (
    payload: LeaveRoomPayload,
    ack: (res: RpcResult<null>) => void,
  ) => void;
  move: (
    payload: MovePayload,
    ack: (res: RpcResult<null>) => void,
  ) => void;
  reportTimeout: (
    payload: ReportTimeoutPayload,
    ack: (res: RpcResult<null>) => void,
  ) => void;
  requestRematch: (
    payload: RequestRematchPayload,
    ack: (res: RpcResult<null>) => void,
  ) => void;
  respondRematch: (
    payload: RespondRematchPayload,
    ack: (res: RpcResult<null>) => void,
  ) => void;
};

export type ServerToClientEvents = {
  profile: (payload: ProfilePayload) => void;
  roomUpdate: (room: PublicRoom) => void;
  /**
   * Avisa que a lista de salas mudou (sala criada, encerrada, fechou
   * com 2 jogadores, etc). Cliente que está no lobby refaz listRooms.
   * Emitido pra todos os sockets — quem não está no lobby ignora.
   */
  lobbyUpdated: () => void;
  gameStart: (payload: GameStartPayload) => void;
  stateUpdate: (payload: StateUpdatePayload) => void;
  moveRejected: (payload: MoveRejectedPayload) => void;
  gameOver: (payload: GameOverPayload) => void;
  opponentLeft: () => void;
  rematchRequested: (payload: RematchRequestedPayload) => void;
  rematchDeclined: (payload: RematchDeclinedPayload) => void;
  rematchExpired: (payload: RematchExpiredPayload) => void;
};
