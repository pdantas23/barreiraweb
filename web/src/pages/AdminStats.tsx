// === Dashboard de analytics (admin) ===
//
// Rota /admin/stats. Gate por email (allowlist abaixo). Lê via anon key:
//  - dashboard_stats(): agregados + online (última foto) + hoje
//  - player_activity(): lista por jogador
// As RPCs expõem só nome + contagens (sem IDs/emails) — ver docs/analytics-fase7.sql.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../net/supabase";
import { useAuth } from "../state/auth";

// Emails autorizados a ver o dashboard. Adicione outros aqui se precisar.
const ADMIN_EMAILS = ["paulovitortss@gmail.com"];

type DashboardStats = {
  users: { registered: number; anonymous_real: number; bots: number };
  today: { visited: number; new: number };
  online: {
    taken_at: string;
    online_total: number;
    online_in_lobby: number;
    online_in_game: number;
    registered_online: number;
    anonymous_online: number;
  } | null;
  matches: {
    total: number;
    casual_online: number;
    private_online: number;
    training_offline: number;
    human_vs_human: number;
    human_vs_bot: number;
  };
  platforms: Record<string, number>;
};

type PlayerRow = {
  usuario: string;
  cadastrado: boolean;
  partidas: number;
  ultima_partida: string;
};

type DailyRow = {
  dia: string;
  novos: number;
  partidas: number;
  pico_online: number;
};

const fmtDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const C = {
  bg: "#0b1220",
  card: "#141d2e",
  border: "#22304a",
  text: "#e6edf7",
  dim: "#8aa0c0",
  cyan: "#22d3ee",
  green: "#34d399",
  amber: "#fbbf24",
};

const Stat = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", minWidth: 130 }}>
    <div style={{ fontSize: 12, color: C.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, color: accent ?? C.text, marginTop: 4 }}>{value}</div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 28 }}>
    <h2 style={{ fontSize: 15, color: C.dim, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>{title}</h2>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{children}</div>
  </div>
);

export default function AdminStats() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [s, p, d] = await Promise.all([
      supabase.rpc("dashboard_stats"),
      supabase.rpc("player_activity"),
      supabase.rpc("daily_stats", { p_days: 30 }),
    ]);
    if (s.error) setError(s.error.message);
    else setStats(s.data as DashboardStats);
    if (!p.error) setPlayers((p.data as PlayerRow[]) ?? []);
    if (!d.error) setDaily((d.data as DailyRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  // Auto-refresh do "online" a cada 30s.
  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [isAdmin, load]);

  if (authLoading) {
    return <Shell><p style={{ color: C.dim }}>Carregando…</p></Shell>;
  }

  if (!isAdmin) {
    return (
      <Shell>
        <h1 style={{ color: C.text }}>Acesso restrito</h1>
        <p style={{ color: C.dim }}>Esta página é só para administradores.</p>
        <Link to="/" style={{ color: C.cyan }}>← Voltar ao início</Link>
      </Shell>
    );
  }

  const on = stats?.online;

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ color: C.text, margin: 0, fontSize: 24 }}>📊 Dashboard</h1>
        <button
          onClick={() => void load()}
          style={{ background: C.cyan, color: "#04212b", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}
        >
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {error && <p style={{ color: "#f87171" }}>Erro: {error}</p>}

      <Section title={`Online agora${on ? ` (às ${fmtDate(on.taken_at)})` : ""}`}>
        {on ? (
          <>
            <Stat label="Online total" value={on.online_total} accent={C.green} />
            <Stat label="No lobby" value={on.online_in_lobby} />
            <Stat label="Em jogo" value={on.online_in_game} accent={C.amber} />
            <Stat label="Logados online" value={on.registered_online} />
            <Stat label="Anônimos online" value={on.anonymous_online} />
          </>
        ) : (
          <p style={{ color: C.dim }}>Sem snapshot ainda (aguarde ~1 min após o deploy).</p>
        )}
      </Section>

      <Section title="Hoje">
        <Stat label="Visitaram hoje" value={stats?.today?.visited ?? "—"} accent={C.cyan} />
        <Stat label="Novos hoje" value={stats?.today?.new ?? "—"} accent={C.green} />
      </Section>

      <Section title="Usuários">
        <Stat label="Cadastrados" value={stats?.users?.registered ?? "—"} accent={C.cyan} />
        <Stat label="Anônimos reais" value={stats?.users?.anonymous_real ?? "—"} />
        <Stat label="Bots (em players)" value={stats?.users?.bots ?? "—"} accent={C.dim} />
      </Section>

      <Section title="Partidas">
        <Stat label="Total" value={stats?.matches?.total ?? "—"} accent={C.cyan} />
        <Stat label="Casual online" value={stats?.matches?.casual_online ?? "—"} />
        <Stat label="Sala privada" value={stats?.matches?.private_online ?? "—"} />
        <Stat label="Treino offline" value={stats?.matches?.training_offline ?? "—"} />
        <Stat label="Humano x humano" value={stats?.matches?.human_vs_human ?? "—"} accent={C.green} />
        <Stat label="Humano x bot" value={stats?.matches?.human_vs_bot ?? "—"} accent={C.amber} />
      </Section>

      <Section title="Plataformas">
        {stats?.platforms && Object.keys(stats.platforms).length > 0 ? (
          Object.entries(stats.platforms).map(([plat, n]) => (
            <Stat key={plat} label={plat} value={n} />
          ))
        ) : (
          <p style={{ color: C.dim }}>Nenhuma plataforma registrada ainda.</p>
        )}
      </Section>

      <Section title="Por dia (últimos 30)">
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: C.dim, textAlign: "left" }}>
                <th style={th}>Dia</th>
                <th style={{ ...th, textAlign: "right" }}>Novos jogadores</th>
                <th style={{ ...th, textAlign: "right" }}>Partidas</th>
                <th style={{ ...th, textAlign: "right" }}>Pico online</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.dia} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...td, color: C.text }}>{fmtDay(d.dia)}</td>
                  <td style={{ ...td, textAlign: "right", color: C.green }}>{d.novos}</td>
                  <td style={{ ...td, textAlign: "right", color: C.text }}>{d.partidas}</td>
                  <td style={{ ...td, textAlign: "right", color: C.amber }}>{d.pico_online}</td>
                </tr>
              ))}
              {daily.length === 0 && !loading && (
                <tr><td style={td} colSpan={4}><span style={{ color: C.dim }}>Sem dados diários ainda.</span></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Por jogador (${players.length})`}>
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: C.dim, textAlign: "left" }}>
                <th style={th}>Usuário</th>
                <th style={th}>Tipo</th>
                <th style={{ ...th, textAlign: "right" }}>Partidas</th>
                <th style={th}>Última partida</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...td, color: C.text }}>{p.usuario}</td>
                  <td style={td}>
                    <span style={{ color: p.cadastrado ? C.green : C.dim }}>
                      {p.cadastrado ? "cadastrado" : "anônimo"}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", color: C.text }}>{p.partidas}</td>
                  <td style={{ ...td, color: C.dim }}>{fmtDate(p.ultima_partida)}</td>
                </tr>
              ))}
              {players.length === 0 && !loading && (
                <tr><td style={td} colSpan={4}><span style={{ color: C.dim }}>Nenhuma partida registrada ainda.</span></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Link to="/" style={{ color: C.cyan, fontSize: 14 }}>← Voltar ao início</Link>
    </Shell>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 };
const td: React.CSSProperties = { padding: "8px 10px" };

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
    <div style={{ maxWidth: 980, margin: "0 auto" }}>{children}</div>
  </div>
);
