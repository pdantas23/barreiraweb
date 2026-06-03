// === FriendsList (apresentacional) ===
//
// Lista de amigos com bolinha de status (verde online / cinza offline /
// âmbar em-partida) e botão "Convidar" só pra quem está online e livre.
// Também mostra pedidos recebidos (aceitar/recusar). Sem estado de rede —
// recebe dados e callbacks por props (o container wireia o socket).

import {
  IoCheckmark,
  IoClose,
  IoGameController,
  IoPeopleOutline,
  IoTrashOutline,
  IoTrophy,
} from "react-icons/io5";
import type { Friend, FriendStatus } from "@barreira/shared";

const STATUS_COLOR: Record<FriendStatus, string> = {
  online: "#22C55E",
  offline: "#9AAACA",
  "in-game": "#F4B619",
};

const STATUS_LABEL: Record<FriendStatus, string> = {
  online: "Online",
  offline: "Offline",
  "in-game": "Em partida",
};

type Props = {
  friends: Friend[];
  incomingRequests?: string[];
  outgoingRequests?: string[];
  onInvite?: (username: string) => void;
  onAccept?: (username: string) => void;
  onDecline?: (username: string) => void;
  onRemove?: (username: string) => void;
  invitingUsername?: string | null;
  // "bare": sem card/cabeçalho próprios (quando embutido num modal que já
  // tem chrome). O container externo controla altura/scroll.
  bare?: boolean;
};

export const FriendsList = ({
  friends,
  incomingRequests = [],
  outgoingRequests = [],
  onInvite,
  onAccept,
  onDecline,
  onRemove,
  invitingUsername = null,
  bare = false,
}: Props) => {
  return (
    <div className={bare ? "flex flex-col" : "bg-white rounded-2xl border border-[#DDEAFF] overflow-hidden"}>
      {!bare && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#DDEAFF] bg-gradient-to-r from-[#F5F8FF] to-white">
          <IoPeopleOutline size={16} color="#3D6FFF" />
          <span className="text-navy text-[12px] font-extrabold tracking-[1px]">AMIGOS</span>
        </div>
      )}

      {/* Pedidos recebidos */}
      {incomingRequests.length > 0 && (
        <div className="border-b border-[#F0F4FF]">
          <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted">
            Pedidos
          </div>
          {incomingRequests.map((u) => (
            <div key={`req-${u}`} className="flex items-center px-4 py-2 gap-2">
              <span className="flex-1 text-[13px] font-semibold text-navy truncate" title={u}>
                {u}
              </span>
              <button
                aria-label={`Aceitar ${u}`}
                onClick={() => onAccept?.(u)}
                className="w-7 h-7 rounded-full bg-[#22C55E]/15 flex items-center justify-center cursor-pointer hover:opacity-80 border-none"
              >
                <IoCheckmark size={16} color="#16A34A" />
              </button>
              <button
                aria-label={`Recusar ${u}`}
                onClick={() => onDecline?.(u)}
                className="w-7 h-7 rounded-full bg-[#FF3D6F]/10 flex items-center justify-center cursor-pointer hover:opacity-80 border-none"
              >
                <IoClose size={16} color="#E04256" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lista de amigos */}
      {friends.length === 0 && incomingRequests.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <span className="block text-navy text-[13px] font-bold">Você ainda não tem amigos.</span>
          <span className="block text-muted text-[11px] mt-1">
            Adicione pelo username ou compartilhe seu link.
          </span>
        </div>
      ) : (
        <div className="flex flex-col">
          {friends.map((f) => {
            const canInvite = f.status === "online";
            return (
              <div key={f.username} className="flex items-center px-4 py-2.5 gap-2 border-b border-[#F0F4FF] last:border-b-0">
                <span
                  aria-label={STATUS_LABEL[f.status]}
                  title={STATUS_LABEL[f.status]}
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: STATUS_COLOR[f.status] }}
                  data-status={f.status}
                />
                <span className="flex-1 text-[13px] font-semibold text-navy truncate" title={f.username}>
                  {f.username}
                </span>
                <span className="flex items-center gap-1 text-[12px] font-bold text-brand font-mono tabular-nums flex-shrink-0">
                  <IoTrophy size={11} color="#F4B619" />
                  {f.trofeus ?? 0}
                </span>
                {canInvite ? (
                  <button
                    aria-label={`Convidar ${f.username}`}
                    onClick={() => onInvite?.(f.username)}
                    disabled={invitingUsername === f.username}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand text-white text-[11px] font-bold cursor-pointer hover:opacity-90 border-none disabled:opacity-50"
                  >
                    <IoGameController size={13} />
                    Convidar
                  </button>
                ) : (
                  <span className="text-[10px] text-muted font-semibold">{STATUS_LABEL[f.status]}</span>
                )}
                {onRemove && (
                  <button
                    aria-label={`Remover ${f.username}`}
                    onClick={() => onRemove(f.username)}
                    className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer hover:bg-[#F0F4FF] border-none bg-transparent"
                  >
                    <IoTrashOutline size={14} color="#9AAACA" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {outgoingRequests.length > 0 && (
        <div className="px-4 py-2 text-[10px] text-muted">
          Pendentes: {outgoingRequests.join(", ")}
        </div>
      )}
    </div>
  );
};
