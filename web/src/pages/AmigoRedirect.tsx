// === Rota /amigo/:token — ponte de deep link de amizade ===
//
// Link de convite compartilhável (token com expiração).
//
// Caminho feliz no celular: com o app instalado, o scheme custom
// (barreira://amigo/TOKEN) / Universal Links abrem o app direto, que resgata
// o convite e mostra "X quer ser seu amigo". Se o app não abrir em 1.5s
// (não instalado), seguimos no site:
//   - Logado: resgata o token (cria pedido do DONO→você) e abre o modal de
//     aceitar na home (?friendInvite=USER).
//   - Deslogado: manda pro login preservando o destino.
//   - Erros (expirado/inválido/já amigos/próprio link) → ?friend=CODE (toast).
//
// Transparente: não renderiza UI própria.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../state/auth";
import { redeemFriendInvite } from "../net/api";

const REDIRECT_TIMEOUT_MS = 1500;

const isMobileUA = (): boolean =>
  /android|iphone|ipad|ipod/i.test(navigator.userAgent || "");

export default function AmigoRedirect() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"init" | "web">("init");
  const schemeTried = useRef(false);
  const done = useRef(false);

  // Fase 1: no celular, tenta abrir o app pelo scheme; se não abrir em 1.5s,
  // cai pro fluxo web. No desktop, vai direto pro fluxo web.
  useEffect(() => {
    if (schemeTried.current) return;
    schemeTried.current = true;
    const tk = (token ?? "").trim();
    if (!tk) {
      navigate("/", { replace: true });
      return;
    }
    if (!isMobileUA()) {
      setPhase("web");
      return;
    }
    const appUrl = `barreira://amigo/${encodeURIComponent(tk)}`;
    let appOpened = false;
    const onVisibility = () => {
      if (document.hidden) appOpened = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (!appOpened) setPhase("web");
    }, REDIRECT_TIMEOUT_MS);
    window.location.href = appUrl;
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, navigate]);

  // Fase 2: fluxo web (resgate ou login), assim que a sessão hidratar.
  useEffect(() => {
    if (phase !== "web" || done.current || loading) return;
    const tk = (token ?? "").trim();
    if (!tk) return;
    done.current = true;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/amigo/${tk}`)}`, { replace: true });
      return;
    }
    void (async () => {
      const res = await redeemFriendInvite(tk);
      if (res.ok) {
        navigate(`/?friendInvite=${encodeURIComponent(res.data.fromUsername)}`, { replace: true });
        return;
      }
      const fb =
        res.error === "invite-expired"
          ? "expired"
          : res.error === "already-friends"
            ? "already"
            : res.error === "self-friend"
              ? "self"
              : "invalid";
      navigate(`/?friend=${fb}`, { replace: true });
    })();
  }, [phase, loading, user, token, navigate]);

  return null;
}
