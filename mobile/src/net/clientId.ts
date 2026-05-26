// Identidade persistente do cliente.
//
// Antes era só in-memory (zerava ao matar o app). Agora persiste em
// AsyncStorage — o MESMO clientId sobrevive a reinstalações? Não,
// AsyncStorage zera com uninstall do app. Mas sobrevive a:
// - Kill do app
// - Reboot do device
// - Limpar cache (se o user não escolher "Limpar dados")
//
// Como o `getSocket()` é chamado de forma síncrona em vários lugares,
// fazemos o bootstrap UMA VEZ no _layout.tsx (await initClientId) antes
// de qualquer socket. Depois, getClientId() vira sync e devolve do cache.

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "barreira.clientId";

let cached: string | null = null;

const generate = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

// Bootstrap async — chama UMA VEZ no _layout antes de qualquer conexão.
// Lê do AsyncStorage ou gera novo + persiste.
export const initClientId = async (): Promise<string> => {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch (err) {
    // AsyncStorage raramente falha; se der, gera em memória mesmo.
    console.warn("[clientId] AsyncStorage read failed:", err);
  }

  const fresh = generate();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, fresh);
  } catch (err) {
    console.warn("[clientId] AsyncStorage write failed:", err);
  }
  cached = fresh;
  return fresh;
};

// Sync — depende do bootstrap ter rodado. Se chamarem antes (bug),
// gera um valor temporário pra não crashar — mas isso é defesa,
// não fluxo normal.
export const getClientId = (): string => {
  if (cached) return cached;
  // Defesa: alguém chamou antes do bootstrap. Gera valor in-memory
  // pra não crashar, mas loga porque é bug.
  console.warn(
    "[clientId] getClientId() chamado antes de initClientId(). " +
      "Verifique se _layout.tsx faz await initClientId() no mount.",
  );
  cached = generate();
  return cached;
};
