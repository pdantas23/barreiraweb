// === Rota /sala/:codigo — landing do convite de partida ===
//
// Destino dos links compartilhados (WhatsApp): https://barreirajogo.com/sala/CODE[?pw=SENHA].
//
// Caminho feliz no celular: com o app instalado, Universal Links (iOS) /
// App Links (Android) fazem o SO abrir o app DIRETO na sala — esta página nem
// chega a carregar. Quando ela carrega, é porque o app não está instalado
// (ou é desktop).
//
// Aqui NÃO entramos na sala automaticamente (antes o auto-join começava a
// partida no navegador sozinho). Mostramos um modal com o botão "Entrar na
// partida" — só ao tocar é que entramos (via auto-join da Home: /?join=CODE).
//
// Não disparamos mais o scheme custom (barreira://) — ele provocava o prompt
// do Safari e caía em "Unmatched Route". A abertura no app fica por conta dos
// Universal/App Links.

import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { IoGameController } from "react-icons/io5";

export default function SalaRedirect() {
  const { codigo } = useParams<{ codigo: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const code = (codigo ?? "").toUpperCase().trim();
  const pw = searchParams.get("pw") ?? undefined;

  const siteTarget = useMemo(() => {
    const joinParams = new URLSearchParams({ join: code });
    if (pw) joinParams.set("pw", pw);
    return `/?${joinParams.toString()}`;
  }, [code, pw]);

  if (!code) {
    navigate("/", { replace: true });
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#F0F4FF] to-[#E8EEF8] flex items-center justify-center p-6">
      <div className="w-full max-w-[360px] bg-white rounded-2xl border border-[#DDEAFF] shadow-[0_16px_40px_rgba(26,42,74,0.18)] p-7 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mb-4">
          <IoGameController size={30} color="#3D6FFF" />
        </div>
        <span className="text-[19px] font-extrabold text-navy">Convite para partida</span>
        <span className="text-[13px] text-muted mt-2">
          Você foi convidado para jogar Barreira na sala{" "}
          <b className="text-navy tracking-wide">{code}</b>.
        </span>
        <button
          onClick={() => navigate(siteTarget, { replace: true })}
          className="mt-6 w-full py-3.5 rounded-xl bg-brand text-white text-[15px] font-black cursor-pointer hover:opacity-90 border-none"
        >
          Entrar na partida
        </button>
        <button
          onClick={() => navigate("/", { replace: true })}
          className="mt-2 w-full py-2.5 rounded-xl bg-transparent text-muted text-[13px] font-bold cursor-pointer hover:bg-[#F0F4FF] border-none"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
