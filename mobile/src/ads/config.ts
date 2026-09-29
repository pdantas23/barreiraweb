import { Platform } from "react-native";

// === Configuração do AdMob.
//
// Enquanto os IDs reais estiverem vazios, o app usa os blocos de TESTE do
// Google (anúncio com a faixa "Test Ad", sem receita e sem risco de
// invalidar a conta). Ao criar a conta AdMob:
//   1. Preencha REAL_INTERSTITIAL abaixo com os IDs dos blocos criados.
//   2. Troque androidAppId/iosAppId no plugin do app.json pelos IDs reais.
//   3. Novo build nativo (EAS) — o App ID vai no manifest, não é OTA.

const REAL_INTERSTITIAL = {
  android: "",
  ios: "",
};

// Blocos de teste oficiais do Google (mesmos de TestIds.INTERSTITIAL).
const TEST_INTERSTITIAL = {
  android: "ca-app-pub-3940256099942544/1033173712",
  ios: "ca-app-pub-3940256099942544/4411468910",
};

const platformKey = Platform.OS === "ios" ? "ios" : "android";
const realId = REAL_INTERSTITIAL[platformKey];

export const ADS_TEST_MODE = __DEV__ || !realId;

export const INTERSTITIAL_UNIT_ID = ADS_TEST_MODE
  ? TEST_INTERSTITIAL[platformKey]
  : realId;

// === Frequência (pensada pra não espantar jogador novo).
/** Partidas terminadas antes do primeiro anúncio (por instalação). */
export const FREE_GAMES_BEFORE_FIRST_AD = 3;
/** Mostra 1 anúncio a cada N partidas terminadas. */
export const GAMES_BETWEEN_ADS = 3;
/** Intervalo mínimo entre dois anúncios, em ms. */
export const MIN_MS_BETWEEN_ADS = 3 * 60 * 1000;
