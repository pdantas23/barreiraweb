// === Rota /sala/:codigo — ponte de deep link ===
//
// Destino dos links compartilhados (WhatsApp): https://barreirajogo.com/sala/CODE[?pw=SENHA].
//
// Caminho feliz no celular: com o app instalado, Universal Links (iOS) /
// App Links (Android) fazem o SO abrir o app DIRETO na sala — esta página
// nem chega a carregar. Quando ela carrega, é porque o app não está
// instalado (ou o link foi aberto num contexto onde o UL não dispara).
//
// Aqui então:
//   - Desktop: cai direto no auto-join existente da Home (/?join=CODE).
//   - Mobile: tenta o scheme custom (barreira://sala/CODE) como último
//     recurso e, se nada acontecer em 1.5s, segue no site (auto-join).
//
// Transparente de propósito: não renderiza tela de loading/redirect.

import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const REDIRECT_TIMEOUT_MS = 1500;

const isMobileUA = (): boolean =>
  /android|iphone|ipad|ipod/i.test(navigator.userAgent || "");

export default function SalaRedirect() {
  const { codigo } = useParams<{ codigo: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = (codigo ?? "").toUpperCase().trim();
    const pw = searchParams.get("pw") ?? undefined;

    if (!code) {
      navigate("/", { replace: true });
      return;
    }

    // Destino no site: o auto-join que a Home já implementa (?join=CODE[&pw=]).
    const joinParams = new URLSearchParams({ join: code });
    if (pw) joinParams.set("pw", pw);
    const siteTarget = `/?${joinParams.toString()}`;

    // Desktop: sem app pra abrir — vai direto pro auto-join.
    if (!isMobileUA()) {
      navigate(siteTarget, { replace: true });
      return;
    }

    // Mobile: tenta abrir o app pelo scheme custom. Se o app abrir, a aba vai
    // pro background (visibilitychange) e cancelamos o fallback; senão, em
    // 1.5s seguimos no site.
    const appUrl = `barreira://sala/${encodeURIComponent(code)}${
      pw ? `?pw=${encodeURIComponent(pw)}` : ""
    }`;

    let appOpened = false;
    const onVisibility = () => {
      if (document.hidden) appOpened = true;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const timer = window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (!appOpened) navigate(siteTarget, { replace: true });
    }, REDIRECT_TIMEOUT_MS);

    // Dispara a tentativa de deep link.
    window.location.href = appUrl;

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [codigo, searchParams, navigate]);

  // Transparente — sem UI de loading/redirect.
  return null;
}
