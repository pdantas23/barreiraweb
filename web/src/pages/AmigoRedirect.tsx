// === Rota /amigo/:token — resgate do convite de amizade ===
//
// Link de convite compartilhável (token com expiração).
//
// Caminho feliz no celular: com o app instalado, Universal Links (iOS) /
// App Links (Android) abrem o app DIRETO na tela de amigo — esta página nem
// chega a carregar. Quando carrega (sem app / desktop):
//   - Logado: resgata o token (cria pedido do DONO→você) e abre o modal de
//     aceitar na home (?friendInvite=USER).
//   - Deslogado: manda pro login preservando o destino.
//   - Erros (expirado/inválido/já amigos/próprio link) → ?friend=CODE (toast).
//
// Não disparamos scheme custom (barreira://) — a abertura no app fica por
// conta dos Universal/App Links. Transparente: sem UI própria.

import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../state/auth";
import { redeemFriendInvite } from "../net/api";

export default function AmigoRedirect() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (loading || done.current) return;
    const tk = (token ?? "").trim();
    if (!tk) {
      navigate("/", { replace: true });
      return;
    }
    if (!user) {
      done.current = true;
      navigate(`/login?next=${encodeURIComponent(`/amigo/${tk}`)}`, { replace: true });
      return;
    }
    done.current = true;
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
  }, [loading, user, token, navigate]);

  return null;
}
