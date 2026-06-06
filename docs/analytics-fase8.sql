-- ============================================================
-- Fase 8: Correções da auditoria + RPCs do redesign
-- ============================================================
-- Roda esse arquivo INTEIRO no Supabase Dashboard → SQL Editor.
-- Idempotente (CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS).
--
-- IMPORTANTE: rode ANTES de fazer deploy do server desta leva — o server
-- passa a gravar matches.source, que é adicionado aqui. Sem a coluna, o
-- INSERT da partida falharia e pararíamos de registrar partidas.
--
-- O que faz:
--  1. matches.source (origem real: lobby/matchmaking/invite/private)
--  2. Backfill de source a partir do mode atual
--  3. dashboard_stats() corrigido (bots de matches, sem treino, fuso BRT,
--     matchmaking contado em casual)
--  4. daily_stats() padronizado em FINALIZADAS + fuso BRT + ativos/dia
--  5. RPCs novas: online_hourly, matches_by_hour, match_duration,
--     retention_d1, engagement
--  6. player_activity() mantido (já correto)
-- ============================================================

-- Fuso do produto. Centraliza pra todas as datas usarem BRT (não UTC).
-- (Função imutável simples; evita repetir a string.)
CREATE OR REPLACE FUNCTION public._brt_date(ts timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT (ts AT TIME ZONE 'America/Sao_Paulo')::date
$$;

CREATE OR REPLACE FUNCTION public._brt_hour(ts timestamptz)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT EXTRACT(HOUR FROM (ts AT TIME ZONE 'America/Sao_Paulo'))::int
$$;


-- 1) matches.source -------------------------------------------
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IN ('lobby', 'matchmaking', 'invite', 'private', 'rescue'));

CREATE INDEX IF NOT EXISTS matches_source_idx ON public.matches(source);

-- 2) Backfill: rows antigas sem source herdam do mode -----------
UPDATE public.matches
  SET source = CASE WHEN mode = 'private_online' THEN 'private' ELSE 'lobby' END
  WHERE source IS NULL;


-- 3) dashboard_stats() ----------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result JSON;
  today date := public._brt_date(now());
BEGIN
  SELECT json_build_object(
    'users', json_build_object(
      'registered', (SELECT COUNT(*) FROM public.profiles),
      'anonymous_real', (
        SELECT COUNT(*) FROM public.players WHERE NOT is_bot AND user_id IS NULL
      ),
      -- ❌→✅ bots NÃO entram em players. Conta partidas finalizadas com bot.
      'bots_in_matches', (
        SELECT COUNT(*) FROM public.matches
        WHERE (p1_is_bot OR p2_is_bot) AND finished_at IS NOT NULL
      )
    ),
    'today', json_build_object(
      'visited', (SELECT COUNT(*) FROM public.players WHERE public._brt_date(last_seen_at) = today),
      'new',     (SELECT COUNT(*) FROM public.players WHERE public._brt_date(created_at)   = today)
    ),
    'online', (
      SELECT row_to_json(s) FROM (
        SELECT taken_at, online_total, online_in_lobby, online_in_game,
               registered_online, anonymous_online
        FROM public.online_snapshots ORDER BY taken_at DESC LIMIT 1
      ) s
    ),
    'matches', json_build_object(
      'total', (SELECT COUNT(*) FROM public.matches WHERE finished_at IS NOT NULL),
      -- matchmaking agora é casual_online (source='matchmaking'); este número já o inclui.
      'casual_online', (
        SELECT COUNT(*) FROM public.matches WHERE mode = 'casual_online' AND finished_at IS NOT NULL
      ),
      'private_online', (
        SELECT COUNT(*) FROM public.matches WHERE mode = 'private_online' AND finished_at IS NOT NULL
      ),
      'matchmaking', (
        SELECT COUNT(*) FROM public.matches WHERE source = 'matchmaking' AND finished_at IS NOT NULL
      ),
      'human_vs_human', (
        SELECT COUNT(*) FROM public.matches
        WHERE NOT p1_is_bot AND NOT p2_is_bot AND finished_at IS NOT NULL
      ),
      'human_vs_bot', (
        SELECT COUNT(*) FROM public.matches
        WHERE (p1_is_bot OR p2_is_bot) AND NOT (p1_is_bot AND p2_is_bot) AND finished_at IS NOT NULL
      )
    ),
    'platforms', (
      SELECT COALESCE(json_object_agg(platform, total), '{}'::json) FROM (
        SELECT last_platform AS platform, COUNT(*) AS total
        FROM public.players
        WHERE NOT is_bot AND last_platform IS NOT NULL
        GROUP BY last_platform
      ) sub
    )
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO anon, authenticated;


-- 4) daily_stats(p_days) — FINALIZADAS + BRT + ativos ----------
CREATE OR REPLACE FUNCTION public.daily_stats(p_days int DEFAULT 30)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH dias AS (
    SELECT (public._brt_date(now()) - g)::date AS dia
    FROM generate_series(0, GREATEST(p_days, 1) - 1) g
  ),
  novos AS (
    SELECT public._brt_date(created_at) AS dia, COUNT(*) AS n
    FROM public.players GROUP BY 1
  ),
  parts AS (
    SELECT public._brt_date(created_at) AS dia, COUNT(*) AS n
    FROM public.matches WHERE finished_at IS NOT NULL GROUP BY 1
  ),
  ativos AS (
    SELECT dia, COUNT(DISTINCT ident) AS n FROM (
      SELECT public._brt_date(created_at) AS dia, COALESCE(p1_user_id::text, p1_client_id) AS ident
        FROM public.matches WHERE NOT p1_is_bot AND finished_at IS NOT NULL
      UNION ALL
      SELECT public._brt_date(created_at) AS dia, COALESCE(p2_user_id::text, p2_client_id) AS ident
        FROM public.matches WHERE NOT p2_is_bot AND finished_at IS NOT NULL
    ) z WHERE ident IS NOT NULL GROUP BY 1
  ),
  onl AS (
    SELECT public._brt_date(taken_at) AS dia, MAX(online_total) AS pico
    FROM public.online_snapshots GROUP BY 1
  )
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.dia DESC), '[]'::json) FROM (
    SELECT d.dia,
           COALESCE(n.n, 0) AS novos,
           COALESCE(p.n, 0) AS partidas,
           COALESCE(a.n, 0) AS ativos,
           COALESCE(o.pico, 0) AS pico_online
    FROM dias d
    LEFT JOIN novos  n ON n.dia = d.dia
    LEFT JOIN parts  p ON p.dia = d.dia
    LEFT JOIN ativos a ON a.dia = d.dia
    LEFT JOIN onl    o ON o.dia = d.dia
  ) t;
$$;
GRANT EXECUTE ON FUNCTION public.daily_stats(int) TO anon, authenticated;


-- 5a) online_hourly(p_hours) — série de online por hora ---------
CREATE OR REPLACE FUNCTION public.online_hourly(p_hours int DEFAULT 24)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.hora), '[]'::json) FROM (
    SELECT to_char(date_trunc('hour', taken_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD"T"HH24:00') AS hora,
           MAX(online_total)  AS online,
           MAX(online_in_game) AS em_jogo
    FROM public.online_snapshots
    WHERE taken_at >= now() - (GREATEST(p_hours,1) || ' hours')::interval
    GROUP BY 1
  ) t;
$$;
GRANT EXECUTE ON FUNCTION public.online_hourly(int) TO anon, authenticated;


-- 5b) matches_by_hour() — partidas por hora do dia (média) ------
CREATE OR REPLACE FUNCTION public.matches_by_hour()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH base AS (
    SELECT public._brt_hour(created_at) AS hora
    FROM public.matches WHERE finished_at IS NOT NULL
  ),
  dias AS (
    SELECT GREATEST(COUNT(DISTINCT public._brt_date(created_at)), 1) AS n
    FROM public.matches WHERE finished_at IS NOT NULL
  )
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.hora), '[]'::json) FROM (
    SELECT h AS hora,
           COALESCE(c.total, 0) AS total,
           ROUND(COALESCE(c.total, 0)::numeric / (SELECT n FROM dias), 2) AS media
    FROM generate_series(0, 23) h
    LEFT JOIN (SELECT hora, COUNT(*) AS total FROM base GROUP BY hora) c ON c.hora = h
  ) t;
$$;
GRANT EXECUTE ON FUNCTION public.matches_by_hour() TO anon, authenticated;


-- 5c) match_duration() — média de lances e tempo ---------------
CREATE OR REPLACE FUNCTION public.match_duration()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT json_build_object(
    'avg_moves',   (SELECT ROUND(AVG(total_moves), 1)
                      FROM public.matches
                      WHERE finished_at IS NOT NULL AND finish_reason = 'goal' AND total_moves > 0),
    'avg_seconds', (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - created_at))))
                      FROM public.matches
                      WHERE finished_at IS NOT NULL AND finish_reason = 'goal'
                        AND finished_at > created_at),
    'sample',      (SELECT COUNT(*)
                      FROM public.matches
                      WHERE finished_at IS NOT NULL AND finish_reason = 'goal' AND total_moves > 0)
  );
$$;
GRANT EXECUTE ON FUNCTION public.match_duration() TO anon, authenticated;


-- 5d) retention_d1(p_days) — % que voltou no dia seguinte -------
-- "Voltou" = jogou uma partida ONLINE registrada em D+1 (offline não conta).
-- Limitado às coortes dentro da janela de registro de partidas.
CREATE OR REPLACE FUNCTION public.retention_d1(p_days int DEFAULT 30)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH cohort AS (
    SELECT COALESCE(user_id::text, client_id) AS ident, public._brt_date(created_at) AS d
    FROM public.players
    WHERE NOT is_bot
      AND public._brt_date(created_at) BETWEEN public._brt_date(now()) - p_days
                                           AND public._brt_date(now()) - 1
  ),
  activity AS (
    SELECT DISTINCT ident, dia FROM (
      SELECT COALESCE(p1_user_id::text, p1_client_id) AS ident, public._brt_date(created_at) AS dia
        FROM public.matches WHERE NOT p1_is_bot AND finished_at IS NOT NULL
      UNION ALL
      SELECT COALESCE(p2_user_id::text, p2_client_id) AS ident, public._brt_date(created_at) AS dia
        FROM public.matches WHERE NOT p2_is_bot AND finished_at IS NOT NULL
    ) z WHERE ident IS NOT NULL
  )
  SELECT json_build_object(
    'cohort',   COUNT(*),
    'returned', COUNT(*) FILTER (WHERE EXISTS (
                  SELECT 1 FROM activity a WHERE a.ident = c.ident AND a.dia = c.d + 1)),
    'pct',      ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
                  SELECT 1 FROM activity a WHERE a.ident = c.ident AND a.dia = c.d + 1))
                  / NULLIF(COUNT(*), 0), 1)
  ) FROM cohort c;
$$;
GRANT EXECUTE ON FUNCTION public.retention_d1(int) TO anon, authenticated;


-- 5e) engagement() — métricas de engajamento -------------------
CREATE OR REPLACE FUNCTION public.engagement()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH played AS (
    SELECT ident, COUNT(*) AS n FROM (
      SELECT COALESCE(p1_user_id::text, p1_client_id) AS ident
        FROM public.matches WHERE NOT p1_is_bot AND finished_at IS NOT NULL
      UNION ALL
      SELECT COALESCE(p2_user_id::text, p2_client_id) AS ident
        FROM public.matches WHERE NOT p2_is_bot AND finished_at IS NOT NULL
    ) z WHERE ident IS NOT NULL GROUP BY ident
  ),
  periodos AS (
    SELECT CASE
             WHEN public._brt_hour(created_at) < 6  THEN 'madrugada'
             WHEN public._brt_hour(created_at) < 12 THEN 'manha'
             WHEN public._brt_hour(created_at) < 18 THEN 'tarde'
             ELSE 'noite'
           END AS periodo
    FROM public.matches WHERE finished_at IS NOT NULL
  )
  SELECT json_build_object(
    'active_players',          (SELECT COUNT(*) FROM played),
    'avg_matches_per_active',  (SELECT ROUND(AVG(n), 1) FROM played),
    'pct_more_than_3',         (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE n > 3) / NULLIF(COUNT(*), 0), 1) FROM played),
    'by_period', (
      SELECT COALESCE(json_object_agg(periodo, n), '{}'::json)
      FROM (SELECT periodo, COUNT(*) AS n FROM periodos GROUP BY periodo) p
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.engagement() TO anon, authenticated;


-- 6) player_activity() — mantido (já correto) ------------------
-- (sem mudança; continua de analytics-fase7.sql)

-- ============================================================
-- VERIFICAÇÃO:
--   SELECT public.dashboard_stats();
--   SELECT public.daily_stats(30);
--   SELECT public.online_hourly(24);
--   SELECT public.matches_by_hour();
--   SELECT public.match_duration();
--   SELECT public.retention_d1(30);
--   SELECT public.engagement();
-- ============================================================
