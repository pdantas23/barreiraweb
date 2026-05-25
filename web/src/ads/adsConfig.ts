/**
 * Configuração do Google AdSense.
 *
 * REGRA: ads APENAS em páginas com conteúdo editorial real (/regras,
 * /estrategias, /sobre, /privacy). NUNCA em telas comportamentais
 * (/, /online, /game, /online-game) — isso viola a política
 * "Anúncios veiculados pelo Google em telas sem conteúdo do editor".
 *
 * TODO: substituir pelos IDs reais após reaprovação do site no AdSense.
 * 1. https://adsense.google.com > Ads > By ad unit > Create new
 * 2. Copiar o slot ID gerado para os campos abaixo
 */

/** ID do publisher */
export const AD_CLIENT = "ca-pub-2366664885069425";

/**
 * Slot IDs para cada posição de anúncio.
 * Cada slot é criado no painel do AdSense > Ads > By ad unit.
 */
export const AD_SLOTS = {
  /** Banner horizontal responsivo nas páginas de conteúdo (Regras, Estrategias, Sobre) */
  contentBanner: "9953596385",
} as const;

/** Ambiente de teste: quando true, carrega ads em modo de teste */
export const AD_TEST_MODE = (import.meta as unknown as { env: { DEV: boolean } }).env.DEV;
