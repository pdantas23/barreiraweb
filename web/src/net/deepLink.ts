// Suporte ao fluxo de login vindo do app mobile.
//
// O app abre o site em /login?from=app&redirect=<URL>, onde <URL> é o deep
// link gerado pelo Expo (`barreira://auth` em standalone, `exp://...` em
// Expo Go). Após login/cadastro bem-sucedido, redirecionamos o browser pra
// essa URL com tokens da sessão na query — o app captura via Linking, chama
// supabase.auth.setSession() e fica logado.
//
// Tokens vão na query do deep link. Deep links nativos não ficam no history
// do browser (são interceptados direto pelo OS), então é seguro pra esse
// caso de uso. Se quiser mais blindagem, migrar pra PKCE/code exchange.

import type { Session } from "@supabase/supabase-js";

export type AppRedirectParams = {
  from: string | null;
  redirect: string | null;
};

/** Lê `from` e `redirect` da URL atual. */
export const readAppRedirect = (): AppRedirectParams => {
  const params = new URLSearchParams(window.location.search);
  return {
    from: params.get("from"),
    redirect: params.get("redirect"),
  };
};

/** Adiciona from/redirect numa URL relativa, preservando os params atuais. */
export const withAppParams = (path: string): string => {
  const { from, redirect } = readAppRedirect();
  if (!from || !redirect) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}from=${encodeURIComponent(from)}&redirect=${encodeURIComponent(redirect)}`;
};

/**
 * Se o usuário veio do app (from=app), redireciona o browser pra deep link
 * `redirect?access_token=...&refresh_token=...` e devolve true. Caso contrário
 * devolve false e o caller segue o fluxo normal (navigate dentro do SPA).
 */
export const redirectToAppIfFromApp = (session: Session | null): boolean => {
  const { from, redirect } = readAppRedirect();
  if (from !== "app" || !redirect || !session) return false;

  const sep = redirect.includes("?") ? "&" : "?";
  const url =
    `${redirect}${sep}access_token=${encodeURIComponent(session.access_token)}` +
    `&refresh_token=${encodeURIComponent(session.refresh_token)}`;

  // window.location.href dispara o deep link; o app intercepta e o browser
  // mostra "Abrir Barreira?" (ou abre direto se for in-app browser do Expo).
  window.location.href = url;
  return true;
};
