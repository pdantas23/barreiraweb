// === FriendsHub (container) ===
//
// Cola os componentes de amizade ao socket/estado real:
//  - botão no header (ícone) que abre o painel (FriendsList + AddFriend);
//  - FriendInviteDropdown global (convite de partida que chega por push);
//  - toast discreto quando um convite é recusado;
//  - feedback do deep link /amigo (?friend=sent:USER) ao voltar pra home.
//
// Só renderiza pra usuários logados (amizade exige login).

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IoPeople } from "react-icons/io5";
import type { FriendsData } from "@barreira/shared";
import { useAuth } from "../state/auth";
import { usePlayerName } from "../state/profile";
import { connectSocket, getSocket } from "../net/socket";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  joinRoom,
  removeFriend,
  respondGameInvite,
  sendFriendRequest,
  sendGameInvite,
} from "../net/api";
import { FriendsList } from "./FriendsList";
import { AddFriend } from "./AddFriend";
import { FriendInviteDropdown, type GameInvite } from "./FriendInviteDropdown";

const EMPTY: FriendsData = { friends: [], incomingRequests: [], outgoingRequests: [] };

export const FriendsHub = () => {
  const { user, username } = useAuth();
  const playerName = usePlayerName();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FriendsData>(EMPTY);
  const [invite, setInvite] = useState<GameInvite | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    const res = await getFriends();
    if (res.ok) setData(res.data);
  }, [user]);

  // Feedback do deep link /amigo (?friend=sent:USER | error:CODE).
  useEffect(() => {
    const fb = searchParams.get("friend");
    if (!fb) return;
    const [kind, rest] = fb.split(":");
    if (kind === "sent") showToast(`Pedido de amizade enviado para ${rest}.`);
    else if (kind === "error") showToast("Não foi possível enviar o pedido de amizade.");
    searchParams.delete("friend");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, showToast]);

  // Subscrição aos pushes do servidor.
  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();
    void refresh();

    const onFriendReq = () => void refresh();
    const onStatus = () => void refresh();
    const onInvite = (p: GameInvite) => setInvite(p);
    const onInviteExpired = () => setInvite(null);
    const onResponse = (p: { fromUsername: string; accept: boolean; code?: string; password?: string | null }) => {
      if (p.accept && p.code) {
        // O amigo aceitou meu convite — eu sou host na sala criada.
        const sp = new URLSearchParams({ role: "host", code: p.code });
        if (p.password) sp.set("password", p.password);
        navigate(`/online-game?${sp.toString()}`);
      } else if (!p.accept) {
        showToast(`${p.fromUsername} recusou o convite`);
      }
    };

    socket.on("friendRequestReceived", onFriendReq);
    socket.on("friendStatusChanged", onStatus);
    socket.on("gameInviteReceived", onInvite);
    socket.on("gameInviteExpired", onInviteExpired);
    socket.on("gameInviteResponse", onResponse);
    return () => {
      socket.off("friendRequestReceived", onFriendReq);
      socket.off("friendStatusChanged", onStatus);
      socket.off("gameInviteReceived", onInvite);
      socket.off("gameInviteExpired", onInviteExpired);
      socket.off("gameInviteResponse", onResponse);
    };
  }, [user, refresh, navigate, showToast]);

  // Eu (convidado) aceito um convite: entra na sala privada e vai pro jogo.
  const onAcceptInvite = async (fromUsername: string) => {
    setInvite(null);
    const res = await respondGameInvite(fromUsername, true);
    if (res.ok && res.data) {
      const joined = await joinRoom({ code: res.data.code, playerName, password: res.data.password ?? undefined });
      if (joined.ok) {
        navigate(`/online-game?role=guest&code=${res.data.code}`);
      } else {
        showToast("Não foi possível entrar na sala.");
      }
    }
  };

  const onDeclineInvite = async (fromUsername: string) => {
    setInvite(null);
    await respondGameInvite(fromUsername, false);
  };

  const onInviteFriend = async (target: string) => {
    setInviting(target);
    const res = await sendGameInvite(target);
    setInviting(null);
    if (!res.ok) showToast(res.message ?? "Não foi possível convidar.");
    else showToast(`Convite enviado para ${target}.`);
  };

  if (!user) return null;

  return (
    <>
      {/* Trigger no header */}
      <button
        onClick={() => { setOpen(true); void refresh(); }}
        className="relative w-9 h-9 rounded-full bg-white border border-cell-bg flex items-center justify-center cursor-pointer hover:opacity-80"
        aria-label="Amigos"
      >
        <IoPeople size={16} color="#3D6FFF" />
        {data.incomingRequests.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FF3D6F] text-white text-[9px] font-black flex items-center justify-center">
            {data.incomingRequests.length}
          </span>
        )}
      </button>

      {/* Painel */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 pt-16 z-[300]" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[380px] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <AddFriend
              myUsername={username}
              onAdd={async (u) => {
                const res = await sendFriendRequest(u);
                if (res.ok) void refresh();
                return { ok: res.ok, error: res.ok ? undefined : res.message };
              }}
            />
            <FriendsList
              friends={data.friends}
              incomingRequests={data.incomingRequests}
              outgoingRequests={data.outgoingRequests}
              invitingUsername={inviting}
              onInvite={onInviteFriend}
              onAccept={async (u) => { await acceptFriendRequest(u); void refresh(); }}
              onDecline={async (u) => { await declineFriendRequest(u); void refresh(); }}
              onRemove={async (u) => { await removeFriend(u); void refresh(); }}
            />
          </div>
        </div>
      )}

      {/* Convite de partida (global) */}
      <FriendInviteDropdown
        invite={invite}
        onAccept={onAcceptInvite}
        onDecline={onDeclineInvite}
        onExpire={() => setInvite(null)}
      />

      {/* Toast discreto */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[400] bg-navy text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  );
};
