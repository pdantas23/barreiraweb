const STORAGE_KEY = "barreira.clientId";

let cached: string | null = null;

const generate = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const initClientId = (): string => {
  if (cached) return cached;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    cached = stored;
    return stored;
  }
  const fresh = generate();
  localStorage.setItem(STORAGE_KEY, fresh);
  cached = fresh;
  return fresh;
};

export const getClientId = (): string => {
  if (cached) return cached;
  console.warn("[clientId] getClientId() chamado antes de initClientId().");
  cached = generate();
  return cached;
};
