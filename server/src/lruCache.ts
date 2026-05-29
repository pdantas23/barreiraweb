// Cache LRU mínimo com limite de entradas. Usado pelos caches em memória do
// server (resolveAuthUser, profiles) que antes cresciam sem limite — tokens
// rotacionam de hora em hora e cada user gera entradas, então sem teto a
// memória subia indefinidamente num server de longa duração.
//
// Implementação: Map preserva ordem de inserção. Em `get`, reinsere a chave
// (marca como mais recente). Em `set`, se cheio, remove a chave mais antiga.

export type LruCache<V> = {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  has(key: string): boolean;
  delete(key: string): void;
  readonly size: number;
};

export const createLruCache = <V>(maxEntries: number): LruCache<V> => {
  const map = new Map<string, V>();
  return {
    get(key) {
      if (!map.has(key)) return undefined;
      const value = map.get(key) as V;
      // Marca como recém-usada: remove e reinsere no fim.
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key, value) {
      if (map.has(key)) {
        map.delete(key);
      } else if (map.size >= maxEntries) {
        // Remove a entrada menos recentemente usada (a primeira da ordem).
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
      map.set(key, value);
    },
    has(key) {
      return map.has(key);
    },
    delete(key) {
      map.delete(key);
    },
    get size() {
      return map.size;
    },
  };
};
