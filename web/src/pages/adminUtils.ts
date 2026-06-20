// Helpers puros do dashboard de analytics (filtro de período + export CSV).
// Separados do AdminStats.tsx pra serem testáveis sem puxar recharts/supabase.

export type PeriodKey = "today" | "7d" | "30d" | "90d" | "custom";
export const PERIOD_OPTS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "custom", label: "Personalizado" },
];
export const PERIOD_LS = "admin_period";

export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
};
export const todayIso = (): string => isoDate(new Date());

export type PeriodState = { key: PeriodKey; from: string; to: string };

export const loadPeriod = (): PeriodState => {
  try {
    const raw = localStorage.getItem(PERIOD_LS);
    if (raw) {
      const p = JSON.parse(raw) as PeriodState;
      if (p && p.key) return p;
    }
  } catch { /* ignore */ }
  return { key: "30d", from: daysAgo(29), to: todayIso() };
};

// Resolve o range {from,to} (YYYY-MM-DD) a partir do estado de período.
export const rangeOf = (p: PeriodState): { from: string; to: string } => {
  const to = todayIso();
  switch (p.key) {
    case "today": return { from: to, to };
    case "7d": return { from: daysAgo(6), to };
    case "30d": return { from: daysAgo(29), to };
    case "90d": return { from: daysAgo(89), to };
    case "custom": return { from: p.from, to: p.to };
  }
};

// ─── CSV ───
// Converte um array de objetos planos em CSV (vírgula, aspas escapadas, \n).
// Colunas = chaves do primeiro objeto. Vazio → string vazia.
export const toCsv = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
};
