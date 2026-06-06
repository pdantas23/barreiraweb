// === Dashboard de analytics (admin) — redesign Fase 2 ===
//
// Rota /admin/stats. Gate por email (allowlist). Layout com sidebar de seções
// (Visão Geral / Partidas / Jogadores / Engajamento / Tempo Real) + gráficos
// recharts. Histórico vem das RPCs do Supabase (anon key); o "Tempo Real" vem
// do endpoint /admin/live do server (estado em memória, não está no banco).
//
// Correções da auditoria (Fase 1) já refletidas nas RPCs (analytics-fase8.sql):
// bots derivado de matches, treino offline removido, matchmaking = casual com
// source próprio, total_moves, finalizadas em tudo, fuso BRT.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { supabase } from "../net/supabase";
import { useAuth } from "../state/auth";

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
type Retention = { cohort: number; returned: number; pct: number | null };
type Engagement = {
  active_players: number; avg_matches_per_active: number | null; pct_more_than_3: number | null;
  by_period: Record<string, number>;
};
type Live = {
  ts: number;
  rooms: { waiting: number; playing: number; open: { code: string; players: number; isBot: boolean }[] };
  matchmaking: number;
  events: { type: string; at: number; room?: string; detail?: string }[];
};

type Section = "overview" | "matches" | "players" | "engagement" | "realtime";
const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: "overview", label: "Visão Geral", icon: "📊" },
  { key: "matches", label: "Partidas", icon: "🎮" },
  { key: "players", label: "Jogadores", icon: "👤" },
  { key: "engagement", label: "Engajamento", icon: "🔥" },
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

export default function AdminStats() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const [section, setSection] = useState<Section>("overview");
  const [narrow, setNarrow] = useState(typeof window !== "undefined" && window.innerWidth < 820);

  const [dash, setDash] = useState<Dashboard | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [hourly, setHourly] = useState<HourlyRow[]>([]);
  const [byHour, setByHour] = useState<ByHourRow[]>([]);
  const [duration, setDuration] = useState<Duration | null>(null);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, d, p, oh, mbh, dur, ret, eng] = await Promise.all([
      rpc<Dashboard>("dashboard_stats"),
      rpc<DailyRow[]>("daily_stats", { p_days: 30 }),
      rpc<PlayerRow[]>("player_activity"),
      rpc<HourlyRow[]>("online_hourly", { p_hours: 24 }),
      rpc<ByHourRow[]>("matches_by_hour"),
      rpc<Duration>("match_duration"),
      rpc<Retention>("retention_d1", { p_days: 30 }),
      rpc<Engagement>("engagement"),
    ]);
    if (s) setDash(s);
    setDaily(d ?? []);
    setPlayers(p ?? []);
    setHourly(oh ?? []);
    setByHour(mbh ?? []);
    setDuration(dur);
    setRetention(ret);
    setEngagement(eng);
    setLoading(false);
  }, []);

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
          <main style={{ padding: "16px 20px 48px", maxWidth: 1100, margin: "0 auto" }}>
            {section === "overview" && <Overview dash={dash} hourly={hourly} />}
            {section === "matches" && <Matches dash={dash} daily={daily} byHour={byHour} duration={duration} />}
            {section === "players" && <Players daily={daily} players={players} retention={retention} />}
            {section === "engagement" && <EngagementView eng={engagement} />}
            {section === "realtime" && <Realtime live={live} dash={dash} />}
          </main>
        </div>
      </div>
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

function Matches({ dash, daily, byHour, duration }: {
  dash: Dashboard | null; daily: DailyRow[]; byHour: ByHourRow[]; duration: Duration | null;
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

      <ChartCard title="Quando o jogo é mais jogado (média por hora do dia)">
        <BarChart data={byHour.map((b) => ({ ...b, label: `${String(b.hora).padStart(2, "0")}h` }))}>
          {grid}<XAxis dataKey="label" {...axis} interval={1} /><YAxis {...axis} />
          <Tooltip {...tip} />
          <Bar dataKey="media" name="Média/dia" fill={C.cyan} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Partidas por dia (últimos 30)">
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

function Players({ daily, players, retention }: {
  daily: DailyRow[]; players: PlayerRow[]; retention: Retention | null;
}) {
  const series = [...daily].reverse().map((d) => ({ ...d, label: fmtDay(d.dia) }));
  return (
    <>
      <Row>
        <Stat label="Retenção D1" value={retention?.pct != null ? `${retention.pct}%` : "—"} accent={C.green} />
        <Stat label="Coorte (base)" value={retention?.cohort ?? "—"} />
        <Stat label="Voltaram D+1" value={retention?.returned ?? "—"} accent={C.cyan} />
      </Row>

      <ChartCard title="Novos jogadores por dia (últimos 30)">
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

      <SectionTitle>Top jogadores ({players.length})</SectionTitle>
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
function EngagementView({ eng }: { eng: Engagement | null }) {
  const periodData = PERIODS.map((p) => ({ label: p.label, partidas: eng?.by_period?.[p.key] ?? 0 }));
  return (
    <>
      <Row>
        <Stat label="Jogadores ativos" value={eng?.active_players ?? "—"} accent={C.cyan} />
        <Stat label="Média partidas/ativo" value={eng?.avg_matches_per_active ?? "—"} accent={C.green} />
        <Stat label="% com +3 partidas" value={eng?.pct_more_than_3 != null ? `${eng.pct_more_than_3}%` : "—"} accent={C.amber} />
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
    </>
  );
}

const EVENT_LABEL: Record<string, string> = {
  match_started: "▶ Partida iniciada", match_finished: "⏹ Partida encerrada", connect: "● Conectou",
};
function Realtime({ live, dash }: { live: Live | null; dash: Dashboard | null }) {
  const on = dash?.online;
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
          <SectionTitle>Salas abertas no lobby</SectionTitle>
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
          <SectionTitle>Últimos eventos</SectionTitle>
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
  tableWrap: { width: "100%", overflowX: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 16 },
  table: { width: "100%", borderCollapse: "collapse" },
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
    <div style={{ maxWidth: 980, margin: "0 auto" }}>{children}</div>
  </div>
);
