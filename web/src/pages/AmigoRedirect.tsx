// === Rota /amigo/:username ===
//
// Link compartilhável de amizade. Ao acessar logado, envia automaticamente um
// pedido de amizade pro dono do link e redireciona pra home com feedback
// (?friend=...). Se não estiver logado, manda pro login e volta depois.
// Transparente: não renderiza UI própria.

import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../state/auth";
import { sendFriendRequest } from "../net/api";

export default function AmigoRedirect() {
  const { username } = useParams<{ username: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (loading || done.current) return;
    const target = (username ?? "").trim();
    if (!target) {
      navigate("/", { replace: true });
      return;
    }
    if (!user) {
      // Sem login: vai pro login e volta pra cá depois de autenticar.
      done.current = true;
      navigate(`/login?next=${encodeURIComponent(`/amigo/${target}`)}`, { replace: true });
      return;
    }
    done.current = true;
    void (async () => {
      const res = await sendFriendRequest(target);
      const fb = res.ok
        ? `sent:${target}`
        : `error:${res.error}`;
      navigate(`/?friend=${encodeURIComponent(fb)}`, { replace: true });
    })();
  }, [loading, user, username, navigate]);

  return null;
}
