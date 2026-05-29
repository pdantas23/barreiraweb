// Decide quais origens podem abrir socket no backend.
//
// O objetivo do CORS aqui é barrar SITES maliciosos (origens http/https
// arbitrárias) de abrirem socket no nosso server. Clientes legítimos:
//   - App nativo (React Native standalone): NÃO manda header Origin → liberado.
//   - Expo Go / dev client: manda origin com esquema não-browser (exp://,
//     exps://) ou um host de LAN/localhost. Um site no browser NÃO consegue
//     forjar esses (o browser sempre manda http/https do próprio domínio),
//     então liberá-los não enfraquece a proteção contra sites.
//   - Web (browser): http/https — só os domínios do jogo + dev local.
//
// Regressão que isso conserta: a allowlist estrita anterior bloqueava o Expo
// Go num device físico (origin exp://<ip>:8081 ou http://<ip>:8081), derrubando
// TODA a conexão do mobile em dev — o que aparecia como "erro ao entrar" etc.

const ALLOWED_HTTP_ORIGINS = new Set([
  "https://barreirajogo.com",
  "https://www.barreirajogo.com",
  "http://localhost:5173", // Vite dev (web)
  "http://localhost:3000", // Vite preview (web)
  "http://localhost:8081", // Expo dev (simulador)
]);

// localhost ou faixas de IP privado (LAN) — dev do Expo num device físico.
const isLocalOrLanHost = (host: string): boolean =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(host);

export const isAllowedOrigin = (origin: string | undefined | null): boolean => {
  if (!origin) return true; // app nativo não manda Origin

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return true; // origin atípico (não-URL) — não é um browser, libera
  }

  // Esquemas não-browser (exp://, exps://, etc.) — não forjáveis por um site.
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;

  if (ALLOWED_HTTP_ORIGINS.has(origin)) return true;

  // Dev local / LAN (Expo em device). Sites públicos (evil.com) caem fora.
  return isLocalOrLanHost(url.hostname);
};
