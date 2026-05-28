import type {
  CreateRoomPayload,
  JoinRoomPayload,
  Move,
  PublicRoom,
  RoomDetail,
  RpcResult,
} from "@barreira/shared";
import { connectSocket, whenConnected } from "./socket";

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
  // Espera o socket conectar antes do RPC. Sem isso, no primeiro mount o
  // emitWithAck dispara durante o handshake — o callback de auth (Supabase
  // session) pode demorar e o RPC estourar timeout antes mesmo de o servidor
  // ver a mensagem. Resultado: toast falso de "Sem conexão" na primeira
  // abertura do site, que some no reload (cache + sessão já hidratada).
  return withTimeout(whenConnected().then(fn)).catch((err) => {
    console.warn("[safeRpc] erro capturado:", err?.message ?? err, "| socket connected:", connectSocket().connected);
    return {
      ok: false as const,
      error: "internal-error" as const,
      message: "Sem conexão com o servidor. Verifique sua internet.",
    };
  });
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
