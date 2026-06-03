// === Comparação de versão do app ===
//
// Compara a versão atual (Constants.expoConfig.version, ex "1.1") com a
// min_version e latest_version vindas do app_config (Supabase).
//   - atual < min     → "blocked"  (modal não-dismissível, força atualizar)
//   - atual < latest  → "outdated" (banner dismissível)
//   - caso contrário  → "ok"

export type VersionStatus = "blocked" | "outdated" | "ok";

// Compara duas versões "1.2.3". Retorna -1, 0 ou 1. Tolerante a tamanhos
// diferentes ("1.1" vs "1.1.0") e a segmentos não numéricos (tratados como 0).
export const compareSemver = (a: string, b: string): number => {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
};

export const versionStatus = (
  current: string,
  minVersion: string | null | undefined,
  latestVersion: string | null | undefined,
): VersionStatus => {
  if (minVersion && compareSemver(current, minVersion) < 0) return "blocked";
  if (latestVersion && compareSemver(current, latestVersion) < 0) return "outdated";
  return "ok";
};
