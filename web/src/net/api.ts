import type {
  CreateFriendInviteLinkResult,
  CreateRoomPayload,
  FriendsData,
  InviteAcceptResult,
  JoinRoomPayload,
  Move,
  PublicRoom,
  RedeemFriendInviteResult,
  RoomDetail,
  RpcResult,
} from "@barreira/shared";
import { connectSocket, ensureAuthedSocket, whenConnected } from "./socket";

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
  safeRpc(() =>
    ensureAuthedSocket().then(() => connectSocket().emitWithAck("createRoom", payload)),
  );

export const joinRoom = (
  payload: JoinRoomPayload,
): Promise<RpcResult<RoomDetail>> =>
  safeRpc(() =>
    ensureAuthedSocket().then(() => connectSocket().emitWithAck("joinRoom", payload)),
  );

export const listRooms = (): Promise<RpcResult<{ rooms: PublicRoom[] }>> =>
  safeRpc(() => connectSocket().emitWithAck("listRooms", {}));

export const leaveRoom = (): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("leaveRoom", {}));

export const sendMove = (move: Move): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("move", { move }));

// Avisa o server que o relógio do jogador da vez estourou. O server valida
// com o próprio relógio antes de encerrar e premiar.
export const reportTimeout = (): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("reportTimeout", {}));

export const requestRematch = (): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("requestRematch", {}));

export const respondRematch = (accept: boolean): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("respondRematch", { accept }));

// === Matchmaking (Partida Rápida) ===

// Entra na fila. ensureAuthedSocket pra o server resolver o authUserId (troféu
// na vitória) — anônimo também funciona, só não premia.
export const joinMatchmaking = (): Promise<RpcResult<null>> =>
  safeRpc(() =>
    ensureAuthedSocket().then(() => connectSocket().emitWithAck("joinMatchmaking", {})),
  );

export const leaveMatchmaking = (): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("leaveMatchmaking", {}));

// === Sistema de amizade ===

export const sendFriendRequest = (targetUsername: string): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("sendFriendRequest", { targetUsername }));

export const acceptFriendRequest = (requesterUsername: string): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("acceptFriendRequest", { requesterUsername }));

export const declineFriendRequest = (requesterUsername: string): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("declineFriendRequest", { requesterUsername }));

export const removeFriend = (targetUsername: string): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("removeFriend", { targetUsername }));

export const getFriends = (): Promise<RpcResult<FriendsData>> =>
  safeRpc(() => connectSocket().emitWithAck("getFriends", {}));

// Gera/reusa o link de convite de amizade (token com expiração).
export const createFriendInviteLink = (): Promise<RpcResult<CreateFriendInviteLinkResult>> =>
  safeRpc(() => connectSocket().emitWithAck("createFriendInviteLink", {}));

// Resgata um link: cria pedido do dono→eu e devolve quem me convidou.
export const redeemFriendInvite = (token: string): Promise<RpcResult<RedeemFriendInviteResult>> =>
  safeRpc(() => connectSocket().emitWithAck("redeemFriendInvite", { token }));

export const sendGameInvite = (targetUsername: string): Promise<RpcResult<null>> =>
  safeRpc(() => connectSocket().emitWithAck("sendGameInvite", { targetUsername }));

export const respondGameInvite = (
  fromUsername: string,
  accept: boolean,
): Promise<RpcResult<InviteAcceptResult | null>> =>
  safeRpc(() => connectSocket().emitWithAck("respondGameInvite", { fromUsername, accept }));
