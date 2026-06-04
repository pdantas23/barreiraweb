// === Rota /amigo/:token ===
//
// Link compartilhável de amizade (token com expiração). Ao acessar logado,
// resgata o token: o servidor cria um pedido do DONO do link → este usuário,
// e devolve quem convidou. Redireciona pra home com ?friendInvite=USER pra
// abrir o modal "X quer ser seu amigo" (é só aceitar). Erros (expirado/
// inválido/já amigos) viram ?friend=CODE:USER pra um toast.
// Se não estiver logado, manda pro login e volta depois. Sem UI própria.

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
      // Sem login: vai pro login e volta pra cá depois de autenticar.
      done.current = true;
      navigate(`/login?next=${encodeURIComponent(`/amigo/${tk}`)}`, { replace: true });
      return;
    }
    done.current = true;
    void (async () => {
      const res = await redeemFriendInvite(tk);
      if (res.ok) {
        // Abre o modal de aceitar na home.
        navigate(`/?friendInvite=${encodeURIComponent(res.data.fromUsername)}`, { replace: true });
        return;
      }
      // Mapeia erros conhecidos pra um feedback claro.
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
