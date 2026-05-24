/**
 * Configuração do Google AdSense.
 *
 * TODO: substituir pelos IDs reais após aprovação do site no AdSense.
 * 1. Crie uma conta em https://adsense.google.com
 * 2. Adicione o site barreirajogo.com e aguarde aprovação
 * 3. Crie as ad units no painel e copie os slot IDs abaixo
 */

/** ID do publisher (ca-pub-2366664885069425) */
export const AD_CLIENT = "ca-pub-2366664885069425";

/**
 * Slot IDs para cada posição de anúncio.
 * Cada slot é criado no painel do AdSense > Ads > By ad unit.
 */
export const AD_SLOTS = {
  /** Banner horizontal — topo do jogo e rodapé da home (728x90 desktop / 320x100 mobile) */
  banner: "0000000000",

  /** Retângulo lateral — sidebars do jogo e da home (300x250 ou 300x600) */
  sidebar: "1111111111",

  /** Interstitial — overlay de fim de partida (300x250 dentro do overlay fullscreen) */
  interstitial: "2222222222",
} as const;

/** Ambiente de teste: quando true, carrega ads em modo de teste */
export const AD_TEST_MODE = (import.meta as unknown as { env: { DEV: boolean } }).env.DEV;
