import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FREE_GAMES_BEFORE_FIRST_AD,
  GAMES_BETWEEN_ADS,
  INTERSTITIAL_UNIT_ID,
  MIN_MS_BETWEEN_ADS,
} from "./config";

// === Intersticial do AdMob entre partidas.
//
// Regras:
//   - Nunca durante a partida: só na TRANSIÇÃO depois do fim (revanche,
//     menu, voltar ao lobby).
//   - Online: nunca na revanche (o adversário está esperando) — só ao sair.
//   - Frequência em config.ts (partidas grátis iniciais, 1 a cada N, e
//     intervalo mínimo).
//
// O módulo nativo é carregado com require lazy + try/catch: no Jest e no
// Expo Go ele não existe, e aí tudo vira no-op em vez de derrubar o app.

type AdsModule = typeof import("react-native-google-mobile-ads");

let ads: AdsModule | null = null;
let interstitial: import("react-native-google-mobile-ads").InterstitialAd | null = null;
let loaded = false;
let canRequestAds = false;
let initStarted = false;

let showing: Promise<void> | null = null;

let lifetimeGames = 0;
let gamesSinceLastAd = 0;
let lastAdAt = 0;

const LIFETIME_KEY = "@barreira/ads/lifetimeGames";

const loadNative = (): AdsModule | null => {
  if (ads) return ads;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ads = require("react-native-google-mobile-ads") as AdsModule;
  } catch {
    ads = null;
  }
  return ads;
};

const preload = () => {
  const m = ads;
  if (!m || !canRequestAds || loaded) return;
  if (!interstitial) {
    interstitial = m.InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
      // iOS: sem ATT não há IDFA — pede só anúncio não personalizado pra
      // não precisar do prompt de rastreamento.
      requestNonPersonalizedAdsOnly: Platform.OS === "ios",
    });
    interstitial.addAdEventListener(m.AdEventType.LOADED, () => {
      loaded = true;
    });
    interstitial.addAdEventListener(m.AdEventType.ERROR, () => {
      loaded = false;
    });
  }
  try {
    interstitial.load();
  } catch {
    loaded = false;
  }
};

/** Chamado uma vez no boot. Consentimento (UMP/GDPR) → init do SDK → preload. */
export const initAds = async (): Promise<void> => {
  if (initStarted) return;
  initStarted = true;

  try {
    const stored = await AsyncStorage.getItem(LIFETIME_KEY);
    lifetimeGames = stored ? Number(stored) || 0 : 0;
  } catch {
    lifetimeGames = 0;
  }

  const m = loadNative();
  if (!m) return;
  try {
    // Mostra o formulário de consentimento só onde a lei exige (EEE/UK/CH);
    // no Brasil retorna direto.
    const consent = await m.AdsConsent.gatherConsent();
    canRequestAds = consent.canRequestAds;
  } catch {
    // Falha no UMP (rede, etc.): o SDK ainda decide pelo último estado salvo.
    try {
      const info = await m.AdsConsent.getConsentInfo();
      canRequestAds = info.canRequestAds;
    } catch {
      canRequestAds = false;
    }
  }
  if (!canRequestAds) return;
  try {
    // App classificado como livre (todas as idades): limita o conteúdo dos
    // anúncios a PG — nada adulto aparece entre partidas.
    await m.default().setRequestConfiguration({
      maxAdContentRating: m.MaxAdContentRating.PG,
    });
    await m.default().initialize();
    preload();
  } catch {
    canRequestAds = false;
  }
};

/** Conta uma partida terminada (chamado quando o modal de fim aparece). */
export const recordGameFinished = () => {
  lifetimeGames += 1;
  gamesSinceLastAd += 1;
  AsyncStorage.setItem(LIFETIME_KEY, String(lifetimeGames)).catch(() => undefined);
};

const isDue = () =>
  lifetimeGames > FREE_GAMES_BEFORE_FIRST_AD &&
  gamesSinceLastAd >= GAMES_BETWEEN_ADS &&
  Date.now() - lastAdAt >= MIN_MS_BETWEEN_ADS;

/**
 * Mostra o intersticial se estiver na hora e carregado; resolve quando o
 * anúncio fecha (ou na hora, se não mostrar). Nunca rejeita — quem chama
 * segue o fluxo normal depois do await.
 */
export const showInterstitialIfDue = (): Promise<void> => {
  // Toque duplo durante o anúncio: devolve a mesma promise em vez de
  // tentar apresentar de novo.
  if (showing) return showing;
  const m = ads;
  if (!m || !interstitial || !loaded || !isDue()) {
    preload();
    return Promise.resolve();
  }
  const ad = interstitial;
  showing = new Promise<void>((resolve) => {
    let done = false;
    const unsubs: Array<() => void> = [];
    const finish = () => {
      if (done) return;
      done = true;
      unsubs.forEach((u) => u());
      loaded = false;
      showing = null;
      preload();
      resolve();
    };
    unsubs.push(ad.addAdEventListener(m.AdEventType.CLOSED, finish));
    unsubs.push(ad.addAdEventListener(m.AdEventType.ERROR, finish));
    // Rede de segurança: se o SDK nunca emitir CLOSED, não prende o jogador.
    const guard = setTimeout(finish, 60_000);
    unsubs.push(() => clearTimeout(guard));
    try {
      gamesSinceLastAd = 0;
      lastAdAt = Date.now();
      ad.show().catch(finish);
    } catch {
      finish();
    }
  });
  return showing;
};
