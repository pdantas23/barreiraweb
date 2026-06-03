// === FriendInviteDropdown ===
//
// Dropdown fixo no topo que aparece quando chega um convite de partida.
// Mostra quem convidou, timer regressivo (até expires_at) e Aceitar/Recusar.
// Some sozinho quando o tempo acaba (chama onExpire) ou ao responder.

import { useEffect, useState } from "react";
import { IoGameController, IoCheckmark, IoClose } from "react-icons/io5";

export type GameInvite = { fromUsername: string; expiresAt: number };

type Props = {
  invite: GameInvite | null;
  onAccept: (fromUsername: string) => void;
  onDecline: (fromUsername: string) => void;
  onExpire?: () => void;
};

export const FriendInviteDropdown = ({ invite, onAccept, onDecline, onExpire }: Props) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!invite) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((invite.expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [invite, onExpire]);

  if (!invite || remaining <= 0) return null;

  return (
    <div
      role="alert"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[400] w-[92%] max-w-[420px] bg-white rounded-2xl border border-[#DDEAFF] shadow-[0_10px_30px_rgba(26,42,74,0.18)] px-4 py-3 flex items-center gap-3"
    >
      <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
        <IoGameController size={18} color="#3D6FFF" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-navy font-extrabold truncate">
          {invite.fromUsername} te convidou
        </div>
        <div className="text-[11px] text-muted font-semibold">
          Convite expira em {remaining}s
        </div>
      </div>
      <button
        aria-label="Aceitar convite"
        onClick={() => onAccept(invite.fromUsername)}
        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-brand text-white text-[12px] font-black cursor-pointer hover:opacity-90 border-none"
      >
        <IoCheckmark size={16} /> Aceitar
      </button>
      <button
        aria-label="Recusar convite"
        onClick={() => onDecline(invite.fromUsername)}
        className="w-9 h-9 rounded-xl bg-[#F0F4FF] flex items-center justify-center cursor-pointer hover:opacity-80 border-none"
      >
        <IoClose size={18} color="#9AAACA" />
      </button>
    </div>
  );
};
