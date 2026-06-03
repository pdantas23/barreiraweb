// === AddFriend ===
//
// Adiciona amigo por username e/ou mostra o link compartilhável
// (dominio/amigo/MEU_USERNAME) com botão de copiar. Feedback de "pedido
// enviado" ou erro. Sem rede própria — o envio vem por callback (onAdd).

import { useState } from "react";
import { IoCopyOutline, IoPersonAddOutline } from "react-icons/io5";

type AddResult = { ok: boolean; error?: string };

type Props = {
  onAdd: (username: string) => Promise<AddResult>;
  // username do próprio usuário (pra montar o link de convite).
  myUsername?: string | null;
  // origem da URL; default window.location.origin.
  origin?: string;
};

export const AddFriend = ({ onAdd, myUsername, origin }: Props) => {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const link = myUsername ? `${base}/amigo/${myUsername}` : null;

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

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard pode falhar em http — ignora */
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

        {link && (
          <div className="flex gap-2 items-center">
            <input
              aria-label="Seu link de amizade"
              readOnly
              value={link}
              className="flex-1 px-3 py-2 rounded-lg border border-[#F0F4FF] bg-[#F5F8FF] text-[11px] text-muted outline-none"
            />
            <button
              aria-label="Copiar link"
              onClick={copyLink}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-[#F0F4FF] text-navy text-[11px] font-bold cursor-pointer hover:opacity-80 border-none"
            >
              <IoCopyOutline size={14} /> {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
