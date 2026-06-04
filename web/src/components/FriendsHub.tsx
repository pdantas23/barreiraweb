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
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IoPeople, IoPersonAddOutline, IoShareSocialOutline, IoClose } from "react-icons/io5";
import type { FriendsData } from "@barreira/shared";
import { useAuth } from "../state/auth";
import { usePlayerName } from "../state/profile";
import { connectSocket, getSocket } from "../net/socket";
import {
  acceptFriendRequest,
  createFriendInviteLink,
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
  const { user } = useAuth();
  const playerName = usePlayerName();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false); // modal "adicionar amigo"
  const [pendingRemove, setPendingRemove] = useState<string | null>(null); // confirmação de exclusão
  const [data, setData] = useState<FriendsData>(EMPTY);
  const [invite, setInvite] = useState<GameInvite | null>(null);
  const [linkInvite, setLinkInvite] = useState<string | null>(null); // "X quer ser seu amigo"
  const [acceptingLink, setAcceptingLink] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null); // link de convite (token) pré-gerado
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

  // Deep link /amigo: abre o modal "X quer ser seu amigo" (?friendInvite=USER)
  // ou mostra um toast de erro (?friend=expired|already|self|invalid).
  useEffect(() => {
    const fromUser = searchParams.get("friendInvite");
    const fb = searchParams.get("friend");
    if (!fromUser && !fb) return;
    if (fromUser) {
      setLinkInvite(fromUser);
    } else if (fb === "expired") {
      showToast("Este link de convite expirou.");
    } else if (fb === "already") {
      showToast("Vocês já são amigos.");
    } else if (fb === "self") {
      showToast("Esse é o seu próprio link de convite.");
    } else if (fb === "invalid") {
      showToast("Link de convite inválido.");
    }
    searchParams.delete("friendInvite");
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

  // Pré-gera o link de convite (token) ao abrir o painel, pra o botão de
  // compartilhar não precisar de await (preserva o gesto do usuário no
  // navigator.share, que o Safari invalida após um await).
  const ensureInviteLink = useCallback(async (): Promise<string | null> => {
    if (inviteLink) return inviteLink;
    const res = await createFriendInviteLink();
    if (!res.ok) return null;
    const link = `${window.location.origin}/amigo/${res.data.token}`;
    setInviteLink(link);
    return link;
  }, [inviteLink]);

  useEffect(() => {
    if (open && !inviteLink) void ensureInviteLink();
  }, [open, inviteLink, ensureInviteLink]);

  // Compartilha o link de amizade com mensagem personalizada. O link vai
  // DENTRO do texto (e não no campo `url`) — assim apps como WhatsApp não
  // duplicam o link (texto + url anexada).
  const shareLink = async () => {
    const link = inviteLink ?? (await ensureInviteLink());
    if (!link) {
      showToast("Não foi possível gerar o link agora.");
      return;
    }
    const message = `Bora jogar Barreira? 🧱 Me adiciona como amigo: ${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Barreira", text: message });
      } else {
        await navigator.clipboard.writeText(message);
        showToast("Convite copiado!");
      }
    } catch {
      /* compartilhamento cancelado ou clipboard indisponível — ignora */
    }
  };

  // Modal "X quer ser seu amigo": aceita (vira amizade) ou recusa o pedido
  // que o link criou (dono do link → este usuário).
  const onAcceptLinkInvite = async () => {
    const from = linkInvite;
    if (!from) return;
    setAcceptingLink(true);
    const res = await acceptFriendRequest(from);
    setAcceptingLink(false);
    setLinkInvite(null);
    if (res.ok) {
      void refresh();
      showToast(`Vocês agora são amigos! 🎉`);
    } else {
      showToast(res.message ?? "Não foi possível aceitar.");
    }
  };

  const onDeclineLinkInvite = async () => {
    const from = linkInvite;
    setLinkInvite(null);
    if (from) await declineFriendRequest(from);
  };

  // Confirma exclusão de amigo (o ícone de lixo só abre o diálogo).
  const confirmRemove = async () => {
    const u = pendingRemove;
    if (!u) return;
    setPendingRemove(null);
    await removeFriend(u);
    void refresh();
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

      {/* Overlays via portal no body: escapam do contexto de empilhamento do
          header (senão o troféu flutuante z-100 fica por cima). */}
      {createPortal(
        <>
      {/* Painel: card único centralizado, lista scrollável, botões fixos no
          rodapé. z alto pra ficar acima do troféu flutuante do leaderboard. */}
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000]" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-[380px] h-[70vh] max-h-[560px] bg-white rounded-2xl border border-[#DDEAFF] shadow-[0_16px_40px_rgba(26,42,74,0.25)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#DDEAFF] bg-gradient-to-r from-[#F5F8FF] to-white flex-shrink-0">
              <IoPeople size={16} color="#3D6FFF" />
              <span className="flex-1 text-navy text-[12px] font-extrabold tracking-[1px]">AMIGOS</span>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer hover:bg-[#F0F4FF] border-none bg-transparent">
                <IoClose size={18} color="#9AAACA" />
              </button>
            </div>

            {/* Lista scrollável (ocupa o espaço; rola se precisar) */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <FriendsList
                bare
                friends={data.friends}
                incomingRequests={data.incomingRequests}
                outgoingRequests={data.outgoingRequests}
                invitingUsername={inviting}
                onInvite={onInviteFriend}
                onAccept={async (u) => { await acceptFriendRequest(u); void refresh(); }}
                onDecline={async (u) => { await declineFriendRequest(u); void refresh(); }}
                onRemove={(u) => setPendingRemove(u)}
              />
            </div>

            {/* Rodapé fixo: dois botões dentro do modal */}
            <div className="flex gap-2 p-3 border-t border-[#DDEAFF] flex-shrink-0 bg-white">
              <button
                onClick={() => setAddOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand text-white text-[13px] font-bold cursor-pointer hover:opacity-90 border-none"
              >
                <IoPersonAddOutline size={16} /> Adicionar amigo
              </button>
              <button
                onClick={shareLink}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-navy text-[13px] font-bold cursor-pointer hover:opacity-80 border border-[#DDEAFF]"
              >
                <IoShareSocialOutline size={16} color="#3D6FFF" /> Compartilhar link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal "Adicionar amigo" — só o campo de username */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[1010]" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-[340px] relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setAddOpen(false)}
              aria-label="Fechar"
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white border border-cell-bg shadow-[0_2px_8px_rgba(61,111,255,0.15)] flex items-center justify-center cursor-pointer hover:opacity-80 z-10"
            >
              <IoClose size={18} color="#9AAACA" />
            </button>
            <AddFriend
              onAdd={async (u) => {
                const res = await sendFriendRequest(u);
                if (res.ok) void refresh();
                return { ok: res.ok, error: res.ok ? undefined : res.message };
              }}
            />
          </div>
        </div>
      )}

      {/* Confirmação de exclusão de amigo */}
      {pendingRemove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[1020]" onClick={() => setPendingRemove(null)}>
          <div className="w-full max-w-[320px] bg-white rounded-2xl p-6 flex flex-col items-center shadow-[0_8px_20px_rgba(61,111,255,0.15)]" onClick={(e) => e.stopPropagation()}>
            <span className="text-[16px] font-extrabold text-navy text-center">Remover amigo?</span>
            <span className="text-[13px] text-muted text-center mt-2">
              Tem certeza que quer remover <b className="text-navy">{pendingRemove}</b> da sua lista de amigos?
            </span>
            <div className="flex gap-2.5 mt-5 w-full">
              <button
                onClick={() => setPendingRemove(null)}
                className="flex-1 py-3 rounded-xl bg-cell-bg border-none text-muted font-bold text-sm cursor-pointer hover:opacity-80"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRemove}
                className="flex-1 py-3 rounded-xl bg-[#FF3D6F] border-none text-white font-black text-[15px] cursor-pointer hover:opacity-90"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convite de amizade por link: "X quer ser seu amigo". Clicar fora só
          fecha (o pedido fica na lista de recebidos); "Recusar" recusa. */}
      {linkInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[1040]" onClick={() => setLinkInvite(null)}>
          <div className="w-full max-w-[340px] bg-white rounded-2xl p-6 flex flex-col items-center shadow-[0_8px_20px_rgba(61,111,255,0.15)]" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center mb-3">
              <IoPersonAddOutline size={26} color="#3D6FFF" />
            </div>
            <span className="text-[17px] font-extrabold text-navy text-center">
              <b className="text-brand">{linkInvite}</b> quer ser seu amigo!
            </span>
            <span className="text-[13px] text-muted text-center mt-2">
              Aceite o convite para adicionar <b className="text-navy">{linkInvite}</b> à sua lista de amigos.
            </span>
            <div className="flex gap-2.5 mt-5 w-full">
              <button
                onClick={onDeclineLinkInvite}
                disabled={acceptingLink}
                className="flex-1 py-3 rounded-xl bg-cell-bg border-none text-muted font-bold text-sm cursor-pointer hover:opacity-80 disabled:opacity-50"
              >
                Recusar
              </button>
              <button
                onClick={onAcceptLinkInvite}
                disabled={acceptingLink}
                className="flex-1 py-3 rounded-xl bg-brand border-none text-white font-black text-[15px] cursor-pointer hover:opacity-90 disabled:opacity-50"
              >
                {acceptingLink ? "..." : "Aceitar"}
              </button>
            </div>
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
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1030] bg-navy text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl shadow-lg"
        >
          {toast}
        </div>
      )}
        </>,
        document.body,
      )}
    </>
  );
};
