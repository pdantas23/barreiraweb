// === Leaderboard ===
//
// Mostra top 10 jogadores ordenados por trofeus_casual desc, username asc
// (tiebreak). Le da tabela public.profiles via Supabase (RLS permite leitura
// anonima). Indice composto profiles_trofeus_casual_idx cobre o ORDER BY.
//
// Auto-refresh: so no mount. Se precisar de live update depois, da pra
// inscrever em supabase.channel() observando UPDATEs em profiles.

import { useEffect, useState } from "react";
import { IoTrophy } from "react-icons/io5";
import { supabase } from "../net/supabase";
import { useAuth } from "../state/auth";

type Entry = { username: string; trofeus_casual: number };

const TOP_LIMIT = 10;

export const Leaderboard = ({ className = "" }: { className?: string }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { username: myUsername } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, trofeus_casual")
        .order("trofeus_casual", { ascending: false })
        .order("username", { ascending: true })
        .limit(TOP_LIMIT);

      if (cancelled) return;
      if (error) {
        console.error("[leaderboard]", error);
        setError("Nao foi possivel carregar o ranking.");
        setEntries([]);
      } else {
        setEntries((data ?? []) as Entry[]);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={`bg-white rounded-2xl border border-[#DDEAFF] shadow-[0_2px_8px_rgba(61,111,255,0.06)] overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#DDEAFF] bg-gradient-to-r from-[#F5F8FF] to-white">
        <div className="flex items-center gap-2">
          <IoTrophy size={16} color="#F4B619" />
          <span className="text-navy text-[12px] font-extrabold tracking-[1px]">
            LEADERBOARD
          </span>
        </div>
        <span className="text-muted text-[10px] font-semibold uppercase tracking-wide">
          Top {TOP_LIMIT}
        </span>
      </div>

      {/* Body */}
      {loading ? (
        <div className="px-4 py-8 text-center text-muted text-[12px]">
          Carregando ranking...
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center text-[12px] text-red-500">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <span className="block text-navy text-[13px] font-bold">Nenhum jogador ainda.</span>
          <span className="block text-muted text-[11px] mt-1">
            Cadastre uma conta pra aparecer aqui.
          </span>
        </div>
      ) : (
        <div className="flex flex-col">
          {entries.map((e, i) => {
            const rank = i + 1;
            const isMe = myUsername && e.username.toLowerCase() === myUsername.toLowerCase();
            return (
              <div
                key={`${e.username}-${rank}`}
                className={`flex items-center px-4 py-2.5 ${
                  i < entries.length - 1 ? "border-b border-[#F0F4FF]" : ""
                } ${isMe ? "bg-brand/5" : ""}`}
              >
                <RankBadge rank={rank} />
                <span
                  className={`flex-1 text-[13px] truncate ml-3 ${
                    isMe ? "text-brand font-extrabold" : "text-navy font-semibold"
                  }`}
                  title={e.username}
                >
                  {e.username}
                  {isMe && <span className="text-muted font-normal text-[10px] ml-1">(voce)</span>}
                </span>
                <span className="flex items-center gap-1 text-brand text-[13px] font-extrabold font-mono tabular-nums">
                  <IoTrophy size={11} color="#F4B619" />
                  {e.trofeus_casual}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const MEDAL_STYLE: Record<number, { bg: string; color: string }> = {
  1: { bg: "bg-[#FFF6D6]", color: "text-[#C49000]" },
  2: { bg: "bg-[#EEF2F6]", color: "text-[#7B8794]" },
  3: { bg: "bg-[#FBE7D8]", color: "text-[#A65A2C]" },
};

const RankBadge = ({ rank }: { rank: number }) => {
  const medal = MEDAL_STYLE[rank];
  if (medal) {
    return (
      <div
        className={`w-6 h-6 rounded-full ${medal.bg} flex items-center justify-center flex-shrink-0`}
      >
        <IoTrophy size={11} className={medal.color} />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
      <span className="text-muted text-[12px] font-bold">{rank}</span>
    </div>
  );
};
