// === Dashboard de analytics (admin) — redesign Fase 2 ===
//
// Rota /admin/stats. Gate por email (allowlist). Layout com sidebar de seções
// (Visão Geral / Partidas / Jogadores / Engajamento / Tempo Real) + gráficos
// recharts. Histórico vem das RPCs do Supabase (anon key); o "Tempo Real" vem
// do endpoint /admin/live do server (estado em memória, não está no banco).
//
// Correções da auditoria já refletidas nas RPCs
// (supabase/migrations/20260605_analytics.sql):
// bots derivado de matches, treino offline removido, matchmaking = casual com
// source próprio, total_moves, finalizadas em tudo, fuso BRT.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { supabase } from "../net/supabase";
import { useAuth } from "../state/auth";
import { PERIOD_OPTS, PERIOD_LS, todayIso, loadPeriod, rangeOf, toCsv, type PeriodState } from "./adminUtils";

const ADMIN_EMAILS = ["paulovitortss@gmail.com", "philipmadantas123@gmail.com"];

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "";

// ─── Paleta (tema escuro mantido) ───
const C = {
  bg: "#0b1220", card: "#141d2e", border: "#22304a", text: "#e6edf7", dim: "#8aa0c0",
  cyan: "#22d3ee", green: "#34d399", amber: "#fbbf24", red: "#f87171",
  violet: "#a78bfa", blue: "#60a5fa", pink: "#f472b6",
};
const CHART = [C.cyan, C.green, C.amber, C.violet, C.pink, C.blue];

// ─── Tipos das RPCs ───
type Dashboard = {
  users: { registered: number; anonymous_real: number; bots_in_matches: number };
  today: { visited: number; new: number };
  online: {
    taken_at: string; online_total: number; online_in_lobby: number;
    online_in_game: number; registered_online: number; anonymous_online: number;
  } | null;
  matches: {
    total: number; casual_online: number; private_online: number; matchmaking: number;
    human_vs_human: number; human_vs_bot: number;
  };
  platforms: Record<string, number>;
};
type DailyRow = { dia: string; novos: number; partidas: number; ativos: number; pico_online: number };
type PlayerRow = { usuario: string; cadastrado: boolean; partidas: number; ultima_partida: string };
type HourlyRow = { hora: string; online: number; em_jogo: number };
type ByHourRow = { hora: number; total: number; media: number };
type Duration = { avg_moves: number | null; avg_seconds: number | null; sample: number };
type Engagement = {
  active_players: number; avg_matches_per_active: number | null; pct_more_than_3: number | null;
  matches_per_session: number | null; recurring_players: number;
  by_period: Record<string, number>;
};
// ─── Parte 3 ───
type Outcomes = {
  total: number; abandoned: number; abandono_pct: number | null;
  human_winrate_vs_bot: number | null;
  winrate_by_difficulty: Record<string, { decided: number; human_winrate: number | null }>;
};
type RetentionCohort = { cohort: number; d1_pct: number | null; d7_pct: number | null; d30_pct: number | null };
type Conversion = { total: number; converted: number; pct: number | null };
type HeatRow = { dow: number; hora: number; total: number };
type Funnel = { visited: number; played1: number; played3: number; registered: number };
type WaitTimes = {
  overall_seconds: number | null; sample: number;
  by_hour: { hora: number; avg_seconds: number | null; n: number }[];
};
type BotStats = {
  total: number;
  by_difficulty: Record<string, number>;
  abandono_vs_bot_pct: number | null; abandono_vs_human_pct: number | null;
  avg_seconds_vs_bot: number | null; avg_seconds_vs_human: number | null;
  top_names: { nome: string; n: number }[];
};
type Live = {
  ts: number;
  rooms: { waiting: number; playing: number; open: { code: string; players: number; isBot: boolean }[] };
  matchmaking: number;
  events: { type: string; at: number; room?: string; detail?: string }[];
};

type Section = "overview" | "matches" | "players" | "engagement" | "bots" | "realtime";
const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: "overview", label: "Visão Geral", icon: "📊" },
  { key: "matches", label: "Partidas", icon: "🎮" },
  { key: "players", label: "Jogadores", icon: "👤" },
  { key: "engagement", label: "Engajamento", icon: "🔥" },
  { key: "bots", label: "Bots", icon: "🤖" },
  { key: "realtime", label: "Tempo Real", icon: "🟢" },
];

// ─── Helpers de formatação ───
const fmtDay = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtDate = (iso: string | null | undefined): string =>
  !iso ? "—" : new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const fmtHour = (iso: string): string => {
  const m = /T(\d{2}):/.exec(iso);
  return m ? `${m[1]}h` : iso;
};
const fmtTime = (s: string): string => new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtSeconds = (s: number | null): string => {
  if (s == null) return "—";
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const rpc = async <T,>(name: string, args?: Record<string, unknown>): Promise<T | null> => {
  const { data, error } = await supabase.rpc(name, args);
  if (error) { console.warn(`[admin] rpc ${name}:`, error.message); return null; }
  return data as T;
};

// RPC com timeout opcional. Lança "timeout" se estourar — usado nas queries
// pesadas (heatmap/retenção) pra não travar a página.
const rpcTimeout = async <T,>(name: string, args: Record<string, unknown>, ms: number): Promise<T | null> => {
  return Promise.race([
    rpc<T>(name, args),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
};

// Cache no cliente: TTL (ms) por RPC pesada. Sem entrada = sem cache (refaz
// sempre). Dados de tempo real (live/snapshot) nunca passam por aqui.
const CACHE_TTL: Record<string, number> = {
  retention_cohort: 10 * 60_000,
  heatmap_data:     30 * 60_000,
  funnel:           15 * 60_000,
  bot_stats:        15 * 60_000,
};
// Queries pesadas com timeout de 10s no cliente.
const SLOW_RPCS = new Set(["heatmap_data", "retention_cohort"]);

// ─── Export CSV (arquivo barreira_<secao>_<data>.csv) ───
const downloadCsv = (section: string, rows: Record<string, unknown>[]): void => {
  if (rows.length === 0) return;
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" }); // BOM p/ Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `barreira_${section}_${todayIso()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default function AdminStats() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const [section, setSection] = useState<Section>("overview");
  const [narrow, setNarrow] = useState(typeof window !== "undefined" && window.innerWidth < 820);
  const [period, setPeriod] = useState<PeriodState>(loadPeriod);
  const range = useMemo(() => rangeOf(period), [period]);
  useEffect(() => {
    try { localStorage.setItem(PERIOD_LS, JSON.stringify(period)); } catch { /* ignore */ }
  }, [period]);

  const [dash, setDash] = useState<Dashboard | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [hourly, setHourly] = useState<HourlyRow[]>([]);
  const [byHour, setByHour] = useState<ByHourRow[]>([]);
  const [duration, setDuration] = useState<Duration | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [outcomes, setOutcomes] = useState<Outcomes | null>(null);
  const [retention, setRetention] = useState<RetentionCohort | null>(null);
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [heatmap, setHeatmap] = useState<HeatRow[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [waits, setWaits] = useState<WaitTimes | null>(null);
  const [botStats, setBotStats] = useState<BotStats | null>(null);
  const [errs, setErrs] = useState<Set<string>>(new Set());
  const [live, setLive] = useState<Live | null>(null);
  const [loading, setLoading] = useState(true);
  // Cache cliente keyed por (rpc + range). Persiste entre re-renders/seções.
  const cacheRef = useRef<Map<string, { data: unknown; at: number }>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    // Período: passa o range pras RPCs sensíveis. online_hourly (24h fixo) e
    // retention_d1 (coorte, Parte 3) não usam o filtro.
    const pr = { p_from: range.from, p_to: range.to };
    const ckey = `${range.from}:${range.to}`;
    const nextErrs = new Set<string>();

    // get(): honra cache (TTL keyed por range) + timeout nas pesadas.
    const get = async <T,>(name: string): Promise<T | null> => {
      const ttl = CACHE_TTL[name];
      const cacheKey = `${name}:${ckey}`;
      if (ttl) {
        const hit = cacheRef.current.get(cacheKey);
        if (hit && Date.now() - hit.at < ttl) return hit.data as T; // cache fresco
      }
      try {
        const v = SLOW_RPCS.has(name)
          ? await rpcTimeout<T>(name, pr, 10_000)
          : await rpc<T>(name, pr);
        if (v != null && ttl) cacheRef.current.set(cacheKey, { data: v, at: Date.now() });
        return v;
      } catch (e) {
        console.warn(`[admin] ${name} timeout/erro:`, e);
        nextErrs.add(name);
        return null;
      }
    };

    // Escalona: dispara cada query com gap de 70ms (não estrangula o banco).
    const GAP = 70;
    const fire = <T,>(name: string, i: number): Promise<T | null> =>
      new Promise((res) => setTimeout(() => void get<T>(name).then(res), i * GAP));

    const [s, d, p, mbh, dur, eng, out, ret, conv, heat, fun, wt, bs, oh] = await Promise.all([
      fire<Dashboard>("dashboard_stats", 0),
      fire<DailyRow[]>("daily_stats", 1),
      fire<PlayerRow[]>("player_activity", 2),
      fire<ByHourRow[]>("matches_by_hour", 3),
      fire<Duration>("match_duration", 4),
      fire<Engagement>("engagement", 5),
      fire<Outcomes>("match_outcomes", 6),
      fire<RetentionCohort>("retention_cohort", 7),
      fire<Conversion>("conversion_rate", 8),
      fire<HeatRow[]>("heatmap_data", 9),
      fire<Funnel>("funnel", 10),
      fire<WaitTimes>("matchmaking_wait_times", 11),
      fire<BotStats>("bot_stats", 12),
      // online_hourly: 24h fixo, sem período/cache (usa p_hours).
      new Promise<HourlyRow[] | null>((res) =>
        setTimeout(() => void rpc<HourlyRow[]>("online_hourly", { p_hours: 24 }).then(res), 13 * GAP)),
    ]);

    if (s) setDash(s);
    setDaily(d ?? []);
    setPlayers(p ?? []);
    setByHour(mbh ?? []);
    setDuration(dur);
    setEngagement(eng);
    setOutcomes(out);
    setRetention(ret);
    setConversion(conv);
    setHeatmap(heat ?? []);
    setFunnel(fun);
    setWaits(wt);
    setBotStats(bs);
    setHourly(oh ?? []);
    setErrs(nextErrs);
    setLoading(false);
  }, [range]);

  const loadLive = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/admin/live`, { cache: "no-store" });
      if (res.ok) setLive(await res.json());
    } catch { /* server offline / sem rota — ignora */ }
  }, []);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 820);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    void loadLive();
    const t = setInterval(() => void loadLive(), 15_000);
    return () => clearInterval(t);
  }, [isAdmin, load, loadLive]);

  if (authLoading) return <Shell><p style={{ color: C.dim }}>Carregando…</p></Shell>;
  if (!isAdmin) {
    return (
      <Shell>
        <h1 style={{ color: C.text }}>Acesso restrito</h1>
        <p style={{ color: C.dim }}>Esta página é só para administradores.</p>
        <Link to="/" style={{ color: C.cyan }}>← Voltar ao início</Link>
      </Shell>
    );
  }

  const nav = (
    <nav style={narrow ? styles.navTop : styles.navSide}>
      <div style={{ display: "flex", flexDirection: narrow ? "row" : "column", gap: 4, flexWrap: "wrap" }}>
        {SECTIONS.map((s) => {
          const active = s.key === section;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              style={{ ...styles.navBtn, ...(active ? styles.navBtnActive : {}) }}
            >
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", minHeight: "100vh" }}>
        {!narrow && nav}
        <div style={{ flex: 1, minWidth: 0 }}>
          <header style={styles.header}>
            <h1 style={{ margin: 0, fontSize: 22 }}>📊 Barreira · Analytics</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Link to="/" style={{ color: C.dim, fontSize: 13, textDecoration: "none" }}>← início</Link>
              <button onClick={() => void load()} style={styles.refresh}>
                {loading ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          </header>
          {narrow && nav}
          <PeriodBar period={period} setPeriod={setPeriod} range={range} />
          <main style={{ padding: "16px 20px 48px", maxWidth: 1100, margin: "0 auto" }}>
            {section === "overview" && <Overview dash={dash} hourly={hourly} />}
            {section === "matches" && <Matches dash={dash} daily={daily} byHour={byHour} duration={duration} outcomes={outcomes} />}
            {section === "players" && <Players daily={daily} players={players} retention={retention} conversion={conversion} eng={engagement} retErr={errs.has("retention_cohort")} />}
            {section === "engagement" && <EngagementView eng={engagement} heatmap={heatmap} funnel={funnel} waits={waits} heatErr={errs.has("heatmap_data")} />}
            {section === "bots" && <Bots stats={botStats} />}
            {section === "realtime" && <Realtime live={live} dash={dash} />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ════════════════ Barra de período ════════════════

function PeriodBar({ period, setPeriod, range }: {
  period: PeriodState; setPeriod: (p: PeriodState) => void; range: { from: string; to: string };
}) {
  return (
    <div style={styles.periodBar}>
      <span style={{ fontSize: 12, color: C.dim }}>Período:</span>
      {PERIOD_OPTS.map((o) => {
        const active = o.key === period.key;
        return (
          <button
            key={o.key}
            onClick={() => setPeriod(
              o.key === "custom"
                ? { key: "custom", from: range.from, to: range.to }
                : { ...period, key: o.key },
            )}
            style={{ ...styles.periodBtn, ...(active ? styles.periodBtnActive : {}) }}
          >
            {o.label}
          </button>
        );
      })}
      {period.key === "custom" && (
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="date" value={period.from} max={period.to}
            onChange={(e) => setPeriod({ ...period, from: e.target.value })}
            style={styles.dateInput}
          />
          <span style={{ color: C.dim }}>→</span>
          <input
            type="date" value={period.to} min={period.from} max={todayIso()}
            onChange={(e) => setPeriod({ ...period, to: e.target.value })}
            style={styles.dateInput}
          />
        </span>
      )}
      <span style={{ fontSize: 11, color: C.dim, marginLeft: "auto" }}>{range.from} → {range.to}</span>
    </div>
  );
}

// ════════════════ Seções ════════════════

function Overview({ dash, hourly }: { dash: Dashboard | null; hourly: HourlyRow[] }) {
  const on = dash?.online;
  return (
    <>
      <SectionTitle>Tempo real <Hint>· snapshot a cada ~60s</Hint></SectionTitle>
      <Row>
        <Stat label="Online agora" value={on?.online_total ?? "—"} accent={C.green} />
        <Stat label="Em jogo" value={on?.online_in_game ?? "—"} accent={C.amber} />
        <Stat label="Fora de partida" value={on ? on.online_total - on.online_in_game : "—"} />
        <Stat label="Logados" value={on?.registered_online ?? "—"} accent={C.cyan} />
        <Stat label="Anônimos" value={on?.anonymous_online ?? "—"} />
      </Row>

      <ChartCard title="Online nas últimas 24h">
        <LineChart data={hourly.map((h) => ({ ...h, label: fmtHour(h.hora) }))}>
          {grid}<XAxis dataKey="label" {...axis} /><YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tip} />
          <Line type="monotone" dataKey="online" name="Online" stroke={C.cyan} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="em_jogo" name="Em jogo" stroke={C.amber} strokeWidth={2} dot={false} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </LineChart>
      </ChartCard>

      <SectionTitle>Hoje</SectionTitle>
      <Row>
        <Stat label="Visitaram hoje" value={dash?.today.visited ?? "—"} accent={C.cyan} />
        <Stat label="Novos hoje" value={dash?.today.new ?? "—"} accent={C.green} />
      </Row>

      <SectionTitle>Base</SectionTitle>
      <Row>
        <Stat label="Cadastrados" value={dash?.users.registered ?? "—"} accent={C.cyan} />
        <Stat label="Anônimos reais" value={dash?.users.anonymous_real ?? "—"} />
        <Stat label="Partidas vs bot" value={dash?.users.bots_in_matches ?? "—"} accent={C.dim} />
      </Row>
      <Row>
        {dash && Object.entries(dash.platforms).map(([p, n]) => <Stat key={p} label={p} value={n} />)}
        {dash && Object.keys(dash.platforms).length === 0 && <Empty>Sem plataformas.</Empty>}
      </Row>
    </>
  );
}

function Matches({ dash, daily, byHour, duration, outcomes }: {
  dash: Dashboard | null; daily: DailyRow[]; byHour: ByHourRow[]; duration: Duration | null; outcomes: Outcomes | null;
}) {
  const m = dash?.matches;
  const modePie = m ? [
    { name: "Casual", value: m.casual_online },
    { name: "Privada", value: m.private_online },
  ] : [];
  const oppPie = m ? [
    { name: "vs Bot", value: m.human_vs_bot },
    { name: "vs Humano", value: m.human_vs_human },
  ] : [];
  const byDiff = outcomes?.winrate_by_difficulty ?? {};
  return (
    <>
      <Row>
        <Stat label="Total (finalizadas)" value={m?.total ?? "—"} accent={C.cyan} />
        <Stat label="Casual" value={m?.casual_online ?? "—"} />
        <Stat label="Matchmaking" value={m?.matchmaking ?? "—"} accent={C.violet} />
        <Stat label="Privada" value={m?.private_online ?? "—"} />
        <Stat label="Média de lances" value={duration?.avg_moves ?? "—"} accent={C.green} />
        <Stat label="Duração média" value={fmtSeconds(duration?.avg_seconds ?? null)} accent={C.amber} />
      </Row>
      <Row>
        <Stat label="Taxa de abandono" value={outcomes?.abandono_pct != null ? `${outcomes.abandono_pct}%` : "—"} accent={C.red} />
        <Stat label="Win-rate humano vs bot" value={outcomes?.human_winrate_vs_bot != null ? `${outcomes.human_winrate_vs_bot}%` : "—"} accent={C.green} />
        {(["easy", "medium", "hard"] as const).map((diff) => (
          <Stat key={diff} label={`Win-rate vs ${diff}`}
            value={byDiff[diff]?.human_winrate != null ? `${byDiff[diff].human_winrate}%` : "—"} accent={C.amber} />
        ))}
      </Row>
      {Object.keys(byDiff).length === 0 && (
        <Empty>Win-rate por dificuldade coletando (precisa de partidas vs bot novas, pós-deploy da Parte 2).</Empty>
      )}

      <ChartCard title="Quando o jogo é mais jogado (média por hora do dia)">
        <BarChart data={byHour.map((b) => ({ ...b, label: `${String(b.hora).padStart(2, "0")}h` }))}>
          {grid}<XAxis dataKey="label" {...axis} interval={1} /><YAxis {...axis} />
          <Tooltip {...tip} />
          <Bar dataKey="media" name="Média/dia" fill={C.cyan} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Partidas por dia (no período)">
        <LineChart data={[...daily].reverse().map((d) => ({ ...d, label: fmtDay(d.dia) }))}>
          {grid}<XAxis dataKey="label" {...axis} minTickGap={20} /><YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tip} />
          <Line type="monotone" dataKey="partidas" name="Partidas" stroke={C.green} strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <ChartCard title="Por modo" half>
          <PieChart>
            <Pie data={modePie} dataKey="value" nameKey="name" outerRadius={80} label>
              {modePie.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
            </Pie>
            <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>
        <ChartCard title="Por oponente" half>
          <PieChart>
            <Pie data={oppPie} dataKey="value" nameKey="name" outerRadius={80} label>
              {oppPie.map((_, i) => <Cell key={i} fill={[C.amber, C.green][i % 2]} />)}
            </Pie>
            <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>
      </div>
      {duration && duration.sample === 0 && (
        <Empty>Duração/lances ainda coletando (só conta partidas novas, pós-deploy).</Empty>
      )}
    </>
  );
}

function Players({ daily, players, retention, conversion, eng, retErr }: {
  daily: DailyRow[]; players: PlayerRow[]; retention: RetentionCohort | null;
  conversion: Conversion | null; eng: Engagement | null; retErr: boolean;
}) {
  const series = [...daily].reverse().map((d) => ({ ...d, label: fmtDay(d.dia) }));
  const pct = (v: number | null | undefined) => (v != null ? `${v}%` : "—");
  return (
    <>
      <SectionTitle>Retenção (coorte de cadastro)</SectionTitle>
      {retErr && <ErrorBox>Retenção demorou demais (timeout 10s). Atualize ou reduza o período.</ErrorBox>}
      <Row>
        <Stat label="D1" value={pct(retention?.d1_pct)} accent={C.green} />
        <Stat label="D7" value={pct(retention?.d7_pct)} accent={C.cyan} />
        <Stat label="D30" value={pct(retention?.d30_pct)} accent={C.violet} />
        <Stat label="Coorte (base)" value={retention?.cohort ?? "—"} />
      </Row>
      <SectionTitle>Conversão & recorrência</SectionTitle>
      <Row>
        <Stat label="Conversão anônimo→conta" value={pct(conversion?.pct)} accent={C.green} />
        <Stat label="Converteram" value={conversion ? `${conversion.converted}/${conversion.total}` : "—"} />
        <Stat label="Recorrentes (3+ dias)" value={eng?.recurring_players ?? "—"} accent={C.amber} />
        <Stat label="Partidas/sessão" value={eng?.matches_per_session ?? "—"} accent={C.cyan} />
      </Row>

      <TitleRow title="Série diária"><CsvButton section="por_dia" rows={daily as unknown as Record<string, unknown>[]} /></TitleRow>
      <ChartCard title="Novos jogadores por dia (no período)">
        <LineChart data={series}>
          {grid}<XAxis dataKey="label" {...axis} minTickGap={20} /><YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tip} />
          <Line type="monotone" dataKey="novos" name="Novos" stroke={C.green} strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Jogadores ativos por dia (jogaram online)">
        <BarChart data={series}>
          {grid}<XAxis dataKey="label" {...axis} minTickGap={20} /><YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tip} />
          <Bar dataKey="ativos" name="Ativos" fill={C.cyan} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>

      <TitleRow title={`Top jogadores (${players.length})`}>
        <CsvButton section="jogadores" rows={players as unknown as Record<string, unknown>[]} />
      </TitleRow>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead><tr style={{ color: C.dim, textAlign: "left" }}>
            <th style={th}>Usuário</th><th style={th}>Tipo</th>
            <th style={{ ...th, textAlign: "right" }}>Partidas</th><th style={th}>Última</th>
          </tr></thead>
          <tbody>
            {players.slice(0, 100).map((p, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ ...td, color: C.text }}>{p.usuario}</td>
                <td style={td}><span style={{ color: p.cadastrado ? C.green : C.dim }}>{p.cadastrado ? "cadastrado" : "anônimo"}</span></td>
                <td style={{ ...td, textAlign: "right" }}>{p.partidas}</td>
                <td style={{ ...td, color: C.dim }}>{fmtDate(p.ultima_partida)}</td>
              </tr>
            ))}
            {players.length === 0 && <tr><td style={td} colSpan={4}><span style={{ color: C.dim }}>Sem dados.</span></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

const PERIODS: { key: string; label: string }[] = [
  { key: "madrugada", label: "Madrugada" }, { key: "manha", label: "Manhã" },
  { key: "tarde", label: "Tarde" }, { key: "noite", label: "Noite" },
];
function EngagementView({ eng, heatmap, funnel, waits, heatErr }: {
  eng: Engagement | null; heatmap: HeatRow[]; funnel: Funnel | null; waits: WaitTimes | null; heatErr: boolean;
}) {
  const periodData = PERIODS.map((p) => ({ label: p.label, partidas: eng?.by_period?.[p.key] ?? 0 }));
  const waitData = (waits?.by_hour ?? []).map((b) => ({ ...b, label: `${String(b.hora).padStart(2, "0")}h` }));
  return (
    <>
      <Row>
        <Stat label="Jogadores ativos" value={eng?.active_players ?? "—"} accent={C.cyan} />
        <Stat label="Média partidas/ativo" value={eng?.avg_matches_per_active ?? "—"} accent={C.green} />
        <Stat label="% com +3 partidas" value={eng?.pct_more_than_3 != null ? `${eng.pct_more_than_3}%` : "—"} accent={C.amber} />
        <Stat label="Partidas/sessão" value={eng?.matches_per_session ?? "—"} accent={C.violet} />
      </Row>
      <ChartCard title="Partidas por faixa horária">
        <BarChart data={periodData}>
          {grid}<XAxis dataKey="label" {...axis} /><YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tip} />
          <Bar dataKey="partidas" name="Partidas" radius={[3, 3, 0, 0]}>
            {periodData.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
          </Bar>
        </BarChart>
      </ChartCard>

      <SectionTitle>Heatmap — hora × dia da semana</SectionTitle>
      {heatErr ? <ErrorBox>Heatmap demorou demais (timeout 10s). Atualize ou reduza o período.</ErrorBox> : <Heatmap data={heatmap} />}

      <SectionTitle>Funil de conversão</SectionTitle>
      <FunnelView funnel={funnel} />

      <SectionTitle>Espera no matchmaking</SectionTitle>
      <Row>
        <Stat label="Espera média" value={waits?.overall_seconds != null ? fmtSeconds(waits.overall_seconds) : "—"} accent={C.violet} />
        <Stat label="Amostra" value={waits?.sample ?? "—"} />
      </Row>
      <ChartCard title="Espera no matchmaking por hora (s)">
        <BarChart data={waitData}>
          {grid}<XAxis dataKey="label" {...axis} interval={1} /><YAxis {...axis} />
          <Tooltip {...tip} />
          <Bar dataKey="avg_seconds" name="Espera (s)" fill={C.violet} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>
      {(!waits || waits.sample === 0) && (
        <Empty>Espera de matchmaking coletando (partidas de matchmaking novas, pós-deploy).</Empty>
      )}
    </>
  );
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; // dow 0..6 (Postgres)
function Heatmap({ data }: { data: HeatRow[] }) {
  if (data.length === 0) return <Empty>Sem dados no período.</Empty>;
  const map = new Map<string, number>();
  let max = 0;
  for (const r of data) { map.set(`${r.dow}-${r.hora}`, r.total); if (r.total > max) max = r.total; }
  const cellBg = (v: number) => (v === 0 ? "#0e1626" : `rgba(34,211,238,${(0.12 + (max > 0 ? v / max : 0) * 0.88).toFixed(3)})`);
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, overflowX: "auto", marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "36px repeat(24, 15px)", gap: 3, alignItems: "center" }}>
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={`h${h}`} style={{ fontSize: 8, color: C.dim, textAlign: "center" }}>{h % 6 === 0 ? `${h}` : ""}</div>
        ))}
        {WEEKDAYS.map((wd, dow) => (
          <Fragment key={dow}>
            <div style={{ fontSize: 11, color: C.dim }}>{wd}</div>
            {Array.from({ length: 24 }).map((_, h) => {
              const v = map.get(`${dow}-${h}`) ?? 0;
              return <div key={h} title={`${wd} ${h}h: ${v}`} style={{ width: 15, height: 15, background: cellBg(v), borderRadius: 2 }} />;
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function FunnelView({ funnel }: { funnel: Funnel | null }) {
  if (!funnel) return <Empty>Sem dados.</Empty>;
  const stages = [
    { label: "Visitou", v: funnel.visited },
    { label: "Jogou 1+", v: funnel.played1 },
    { label: "Jogou 3+", v: funnel.played3 },
    { label: "Cadastrou", v: funnel.registered },
  ];
  const max = Math.max(funnel.visited, 1);
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {stages.map((s, i) => {
        const w = Math.round((s.v / max) * 100);
        const pctPrev = i > 0 && stages[i - 1].v > 0 ? Math.round((s.v / stages[i - 1].v) * 100) : null;
        return (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 90, fontSize: 13, color: C.dim }}>{s.label}</div>
            <div style={{ flex: 1, background: "#0e1626", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${w}%`, minWidth: 24, height: 26, background: CHART[i % CHART.length], display: "flex", alignItems: "center", paddingLeft: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#04212b" }}>{s.v}</span>
              </div>
            </div>
            <div style={{ width: 52, fontSize: 12, color: C.dim, textAlign: "right" }}>{pctPrev != null ? `${pctPrev}%` : ""}</div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════ Bots ════════════════

const DIFF_LABEL: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
function Bots({ stats }: { stats: BotStats | null }) {
  const byDiff = stats?.by_difficulty ?? {};
  const diffData = (["easy", "medium", "hard"] as const).map((k) => ({ name: DIFF_LABEL[k], value: byDiff[k] ?? 0 }));
  const hasDiff = diffData.some((d) => d.value > 0);
  return (
    <>
      <Row>
        <Stat label="Partidas vs bot" value={stats?.total ?? "—"} accent={C.cyan} />
        <Stat label="Desistência vs bot" value={stats?.abandono_vs_bot_pct != null ? `${stats.abandono_vs_bot_pct}%` : "—"} accent={C.red} />
        <Stat label="Desistência vs humano" value={stats?.abandono_vs_human_pct != null ? `${stats.abandono_vs_human_pct}%` : "—"} accent={C.amber} />
        <Stat label="Duração média vs bot" value={fmtSeconds(stats?.avg_seconds_vs_bot ?? null)} accent={C.green} />
        <Stat label="Duração média vs humano" value={fmtSeconds(stats?.avg_seconds_vs_human ?? null)} />
      </Row>

      {hasDiff ? (
        <ChartCard title="Dificuldade nas partidas vs bot">
          <BarChart data={diffData}>
            {grid}<XAxis dataKey="name" {...axis} /><YAxis {...axis} allowDecimals={false} />
            <Tooltip {...tip} />
            <Bar dataKey="value" name="Partidas" radius={[3, 3, 0, 0]}>
              {diffData.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
            </Bar>
          </BarChart>
        </ChartCard>
      ) : (
        <Empty>Distribuição de dificuldade coletando — só partidas vs bot novas (pós-deploy da Parte 2) têm `bot_difficulty`.</Empty>
      )}

      <SectionTitle>Top 10 nomes de bot</SectionTitle>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead><tr style={{ color: C.dim, textAlign: "left" }}>
            <th style={th}>Nome</th><th style={{ ...th, textAlign: "right" }}>Partidas</th>
          </tr></thead>
          <tbody>
            {(stats?.top_names ?? []).map((r, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ ...td, color: C.text }}>{r.nome}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.n}</td>
              </tr>
            ))}
            {(!stats || stats.top_names.length === 0) && (
              <tr><td style={td} colSpan={2}><span style={{ color: C.dim }}>Sem nomes (coletando — `p1_name`/`p2_name` só em partidas novas).</span></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

const ErrorBox = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: "rgba(248,113,113,0.1)", border: `1px solid ${C.red}`, borderRadius: 10, padding: "10px 14px", color: C.red, fontSize: 13, marginBottom: 12 }}>
    ⚠ {children}
  </div>
);

const CsvButton = ({ section, rows }: { section: string; rows: Record<string, unknown>[] }) => (
  <button
    onClick={() => downloadCsv(section, rows)}
    disabled={rows.length === 0}
    title={rows.length === 0 ? "Sem dados" : "Exportar CSV"}
    style={{ ...styles.csvBtn, ...(rows.length === 0 ? { opacity: 0.4, cursor: "default" } : {}) }}
  >⬇ CSV</button>
);

// Título de seção com ação à direita (ex.: botão de export).
const TitleRow = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 12px", gap: 12 }}>
    <h2 style={{ fontSize: 14, color: C.dim, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>{title}</h2>
    {children}
  </div>
);

const EVENT_LABEL: Record<string, string> = {
  match_started: "▶ Partida iniciada", match_finished: "⏹ Partida encerrada", connect: "● Conectou",
};
function Realtime({ live, dash }: { live: Live | null; dash: Dashboard | null }) {
  const on = dash?.online;
  const roomRows = (live?.rooms.open ?? []).map((r) => ({ sala: r.code, jogadores: `${r.players}/2`, tipo: r.isBot ? "bot" : "humano" }));
  const eventRows = (live?.events ?? []).map((e) => ({
    tipo: e.type, sala: e.room ?? "", detalhe: e.detail ?? "", quando: new Date(e.at).toISOString(),
  }));
  return (
    <>
      <SectionTitle>Agora <Hint>· atualiza a cada 15s</Hint></SectionTitle>
      <Row>
        <Stat label="Salas abertas" value={live?.rooms.waiting ?? "—"} accent={C.green} />
        <Stat label="Em andamento" value={live?.rooms.playing ?? "—"} accent={C.amber} />
        <Stat label="Na fila (matchmaking)" value={live?.matchmaking ?? "—"} accent={C.violet} />
        <Stat label="Online (snapshot)" value={on?.online_total ?? "—"} accent={C.cyan} />
      </Row>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 320px" }}>
          <TitleRow title="Salas abertas no lobby"><CsvButton section="salas" rows={roomRows} /></TitleRow>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead><tr style={{ color: C.dim, textAlign: "left" }}>
                <th style={th}>Sala</th><th style={th}>Jogadores</th><th style={th}>Tipo</th>
              </tr></thead>
              <tbody>
                {(live?.rooms.open ?? []).map((r) => (
                  <tr key={r.code} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ ...td, color: C.text, fontFamily: "monospace" }}>{r.code}</td>
                    <td style={td}>{r.players}/2</td>
                    <td style={td}><span style={{ color: r.isBot ? C.amber : C.green }}>{r.isBot ? "bot" : "humano"}</span></td>
                  </tr>
                ))}
                {(!live || live.rooms.open.length === 0) && <tr><td style={td} colSpan={3}><span style={{ color: C.dim }}>Nenhuma sala aberta.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ flex: "1 1 320px" }}>
          <TitleRow title="Últimos eventos"><CsvButton section="eventos" rows={eventRows} /></TitleRow>
          <div style={{ ...styles.tableWrap, maxHeight: 360, overflowY: "auto" }}>
            <table style={styles.table}>
              <tbody>
                {(live?.events ?? []).map((e, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{EVENT_LABEL[e.type] ?? e.type}</td>
                    <td style={{ ...td, color: C.dim, fontFamily: "monospace" }}>{e.room ?? ""}</td>
                    <td style={{ ...td, color: C.dim }}>{e.detail ?? ""}</td>
                    <td style={{ ...td, color: C.dim, textAlign: "right", whiteSpace: "nowrap" }}>{fmtTime(new Date(e.at).toISOString())}</td>
                  </tr>
                ))}
                {(!live || live.events.length === 0) && <tr><td style={td} colSpan={4}><span style={{ color: C.dim }}>Sem eventos recentes.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {!live && <Empty>Sem conexão com o servidor (/admin/live). Confirme o deploy do server + nginx.</Empty>}
    </>
  );
}

// ════════════════ UI building blocks ════════════════

const grid = <CartesianGrid stroke={C.border} strokeDasharray="3 3" />;
const axis = { stroke: C.dim, tick: { fill: C.dim, fontSize: 11 } } as const;
const tip = {
  contentStyle: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text },
  labelStyle: { color: C.dim }, itemStyle: { color: C.text },
} as const;

const Stat = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", minWidth: 120, flex: "1 1 120px" }}>
    <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? C.text, marginTop: 4 }}>{value}</div>
  </div>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>{children}</div>
);
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 14, color: C.dim, textTransform: "uppercase", letterSpacing: 1, margin: "8px 0 12px" }}>{children}</h2>
);
const Hint = ({ children }: { children: React.ReactNode }) => (
  <span style={{ textTransform: "none", letterSpacing: 0, fontSize: 12, color: C.dim, fontWeight: 400 }}>{children}</span>
);
const Empty = ({ children }: { children: React.ReactNode }) => (
  <p style={{ color: C.dim, fontSize: 13 }}>{children}</p>
);
const ChartCard = ({ title, half, children }: { title: string; half?: boolean; children: React.ReactElement }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16, flex: half ? "1 1 320px" : undefined }}>
    <div style={{ fontSize: 13, color: C.dim, marginBottom: 12 }}>{title}</div>
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  </div>
);

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 };
const td: React.CSSProperties = { padding: "7px 10px", fontSize: 13 };

const styles: Record<string, React.CSSProperties> = {
  navSide: { width: 190, flexShrink: 0, background: "#0e1626", borderRight: `1px solid ${C.border}`, padding: "20px 12px" },
  navTop: { background: "#0e1626", borderBottom: `1px solid ${C.border}`, padding: "8px 12px" },
  navBtn: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: "transparent", color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap" },
  navBtnActive: { background: C.card, color: C.text },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.border}` },
  refresh: { background: C.cyan, color: "#04212b", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  periodBar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 20px", borderBottom: `1px solid ${C.border}`, background: "#0e1626" },
  periodBtn: { padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  periodBtnActive: { background: C.cyan, color: "#04212b", borderColor: C.cyan },
  dateInput: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "5px 8px", fontSize: 13, colorScheme: "dark" },
  csvBtn: { background: "transparent", color: C.cyan, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  tableWrap: { width: "100%", overflowX: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 16 },
  table: { width: "100%", borderCollapse: "collapse" },
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
    <div style={{ maxWidth: 980, margin: "0 auto" }}>{children}</div>
  </div>
);
