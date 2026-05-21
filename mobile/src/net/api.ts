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

export const createRoom = async (
  payload: CreateRoomPayload,
): Promise<RpcResult<RoomDetail>> => {
  const s = connectSocket();
  return await s.emitWithAck("createRoom", payload);
};

export const joinRoom = async (
  payload: JoinRoomPayload,
): Promise<RpcResult<RoomDetail>> => {
  const s = connectSocket();
  return await s.emitWithAck("joinRoom", payload);
};

export const listRooms = async (): Promise<RpcResult<{ rooms: PublicRoom[] }>> => {
  const s = connectSocket();
  return await s.emitWithAck("listRooms", {});
};

export const leaveRoom = async (): Promise<RpcResult<null>> => {
  const s = connectSocket();
  return await s.emitWithAck("leaveRoom", {});
};

export const sendMove = async (move: Move): Promise<RpcResult<null>> => {
  const s = connectSocket();
  return await s.emitWithAck("move", { move });
};
