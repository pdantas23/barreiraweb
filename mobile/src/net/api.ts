// Wrappers async dos RPCs cliente→server. Cada um devolve RpcResult<T>:
// componente lida com sucesso/falha sem se preocupar com socket internals.

import type {
  CreateRoomPayload,
  JoinRoomPayload,
  Move,
  PublicRoom,
  RoomDetail,
  RpcResult,
} from "@barreira/shared";
import { connectSocket } from "./socket";

const RPC_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms = RPC_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

function safeRpc<T>(fn: () => Promise<RpcResult<T>>): Promise<RpcResult<T>> {
  return withTimeout(fn()).catch(() => ({
    ok: false as const,
    error: "internal-error" as const,
    message: "Sem conexão com o servidor. Verifique sua internet.",
  }));
}

export const createRoom = (
  payload: CreateRoomPayload,
): Promise<RpcResult<RoomDetail>> =>
  safeRpc(() => connectSocket().emitWithAck("createRoom", payload));

export const joinRoom = (
  payload: JoinRoomPayload,
): Promise<RpcResult<RoomDetail>> =>
  safeRpc(() => connectSocket().emitWithAck("joinRoom", payload));

export const listRooms = (): Promise<RpcResult<{ rooms: PublicRoom[] }>> =>
  safeRpc(() => connectSocket().emitWithAck("listRooms", {}));

export const leaveRoom = (): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("leaveRoom", {}));

export const sendMove = (move: Move): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("move", { move }));

export const requestRematch = (): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("requestRematch", {}));

export const respondRematch = (accept: boolean): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("respondRematch", { accept }));
