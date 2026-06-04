// === AddFriend ===
//
// Adiciona amigo por username. Feedback de "pedido enviado" ou erro. Sem rede
// própria — o envio vem por callback (onAdd). O compartilhamento por link
// (token) é tratado pelo FriendsHub, não aqui.

import { useState } from "react";
import { IoPersonAddOutline } from "react-icons/io5";

type AddResult = { ok: boolean; error?: string };

type Props = {
  onAdd: (username: string) => Promise<AddResult>;
};

export const AddFriend = ({ onAdd }: Props) => {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const submit = async () => {
    const username = value.trim();
    if (!username || busy) return;
    setBusy(true);
    setFeedback(null);
    const res = await onAdd(username);
    setBusy(false);
    if (res.ok) {
      setFeedback({ kind: "ok", text: "Pedido enviado!" });
      setValue("");
    } else {
      setFeedback({ kind: "error", text: res.error ?? "Não foi possível enviar o pedido." });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#DDEAFF] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#DDEAFF] bg-gradient-to-r from-[#F5F8FF] to-white">
        <IoPersonAddOutline size={16} color="#3D6FFF" />
        <span className="text-navy text-[12px] font-extrabold tracking-[1px]">ADICIONAR AMIGO</span>
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            aria-label="Username do amigo"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="username"
            className="flex-1 px-3 py-2 rounded-lg border border-[#DDEAFF] text-[13px] text-navy outline-none focus:border-brand"
          />
          <button
            onClick={submit}
            disabled={busy || value.trim().length === 0}
            className="px-3 py-2 rounded-lg bg-brand text-white text-[13px] font-bold cursor-pointer hover:opacity-90 border-none disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>

        {feedback && (
          <div
            role="status"
            className={`text-[12px] font-semibold ${feedback.kind === "ok" ? "text-[#16A34A]" : "text-[#E04256]"}`}
          >
            {feedback.text}
          </div>
        )}
      </div>
    </div>
  );
};
