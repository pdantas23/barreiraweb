-- ============================================================
-- Analytics — migration consolidada (estado final)
-- ============================================================
-- Roda esse arquivo INTEIRO no Supabase Dashboard → SQL Editor.
-- Idempotente e RE-RODÁVEL: representa o estado FINAL do schema + RPCs de
-- analytics (consolida as antigas fases 1, 7 e 8 da auditoria). Rodar várias
-- vezes é seguro (CREATE OR REPLACE / IF NOT EXISTS / backfills com WHERE).
--
-- Dependências externas (de migrations anteriores, fora deste arquivo):
--   - tabela public.players (client_id, display_name, created_at, last_seen_at)
--   - tabela public.profiles (user_id, username)
--
-- O que faz:
--   1. Helpers de fuso (BRT)
--   2. Colunas de analytics em players (is_bot, user_id, last_platform)
--   3. Tabela matches (com source + total_moves) + índices
--   4. Tabela online_snapshots + índice
--   5. RLS: leitura pública (anon/authenticated); escrita só service_role
--   6. RPCs: dashboard_stats, daily_stats, player_activity, user_stats,
--      online_hourly, matches_by_hour, match_duration, retention_d1, engagement
--   7. Backfills (bots, link user_id, source)
-- ============================================================


-- 1) Helpers de fuso (BRT) ------------------------------------
-- Centraliza pra todas as datas usarem America/Sao_Paulo (não UTC).
CREATE OR REPLACE FUNCTION public._brt_date(ts timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT (ts AT TIME ZONE 'America/Sao_Paulo')::date
$$;

CREATE OR REPLACE FUNCTION public._brt_hour(ts timestamptz)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT EXTRACT(HOUR FROM (ts AT TIME ZONE 'America/Sao_Paulo'))::int
$$;


-- 2) Colunas de analytics em players --------------------------
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS last_platform TEXT
    CHECK (last_platform IN ('web', 'ios', 'android'));

CREATE INDEX IF NOT EXISTS players_user_id_idx
  ON public.players(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS players_is_bot_idx ON public.players(is_bot);
-- Performance: filtros por data. Os índices de EXPRESSÃO em _brt_date(...) são
-- o que torna o BETWEEN do filtro de período sargável (a função é IMMUTABLE).
CREATE INDEX IF NOT EXISTS players_created_at_idx ON public.players(created_at);
CREATE INDEX IF NOT EXISTS players_last_seen_idx ON public.players(last_seen_at);
CREATE INDEX IF NOT EXISTS players_brtdate_created_idx ON public.players(public._brt_date(created_at));
CREATE INDEX IF NOT EXISTS players_brtdate_seen_idx ON public.players(public._brt_date(last_seen_at));


-- 3) Tabela matches -------------------------------------------
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('casual_online', 'private_online', 'training_offline')),
  source TEXT CHECK (source IN ('lobby', 'matchmaking', 'invite', 'private', 'rescue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  finish_reason TEXT CHECK (finish_reason IN ('goal', 'timeout_wo', 'leave_wo', 'abandoned')),
  winner SMALLINT CHECK (winner IN (1, 2)),
  total_moves INTEGER DEFAULT 0,
  -- Dificuldade do bot na partida (NULL = sem bot). Persistida no server.
  bot_difficulty TEXT CHECK (bot_difficulty IN ('easy', 'medium', 'hard')),
  -- Espera no matchmaking até a partida formar (ms). NULL = não foi matchmaking.
  wait_ms INTEGER,

  p1_client_id TEXT,
  p1_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  p1_is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  p1_platform TEXT CHECK (p1_platform IN ('web', 'ios', 'android')),
  p1_name TEXT,                                -- display name (pra top de nomes de bot)

  p2_client_id TEXT,
  p2_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  p2_is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  p2_platform TEXT CHECK (p2_platform IN ('web', 'ios', 'android')),
  p2_name TEXT
);

-- Colunas que podem faltar numa tabela matches já existente. Idempotente.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS source TEXT
  CHECK (source IN ('lobby', 'matchmaking', 'invite', 'private', 'rescue'));
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS total_moves INTEGER DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS bot_difficulty TEXT
  CHECK (bot_difficulty IN ('easy', 'medium', 'hard'));
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS wait_ms INTEGER;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS p1_name TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS p2_name TEXT;

CREATE INDEX IF NOT EXISTS matches_p1_client_idx ON public.matches(p1_client_id);
CREATE INDEX IF NOT EXISTS matches_p2_client_idx ON public.matches(p2_client_id);
CREATE INDEX IF NOT EXISTS matches_p1_user_idx ON public.matches(p1_user_id);
CREATE INDEX IF NOT EXISTS matches_p2_user_idx ON public.matches(p2_user_id);
CREATE INDEX IF NOT EXISTS matches_created_at_idx ON public.matches(created_at DESC);
CREATE INDEX IF NOT EXISTS matches_mode_idx ON public.matches(mode);
CREATE INDEX IF NOT EXISTS matches_source_idx ON public.matches(source);
CREATE INDEX IF NOT EXISTS matches_finished_idx
  ON public.matches(finished_at) WHERE finished_at IS NOT NULL;
-- Performance (Fase 3): composites pros agregados + expressão BRT pro período.
CREATE INDEX IF NOT EXISTS matches_bots_idx ON public.matches(p1_is_bot, p2_is_bot);
CREATE INDEX IF NOT EXISTS matches_mode_source_idx ON public.matches(mode, source);
CREATE INDEX IF NOT EXISTS matches_brtdate_idx ON public.matches(public._brt_date(created_at));


-- 4) Tabela online_snapshots ----------------------------------
-- (a coluna temporal é taken_at — não há created_at; já indexada abaixo.)
CREATE TABLE IF NOT EXISTS public.online_snapshots (
  taken_at TIMESTAMPTZ PRIMARY KEY DEFAULT now(),
  online_total INTEGER NOT NULL,
  online_in_lobby INTEGER NOT NULL,
  online_in_game INTEGER NOT NULL,
  registered_online INTEGER NOT NULL DEFAULT 0,
  anonymous_online INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS online_snapshots_taken_idx
  ON public.online_snapshots(taken_at DESC);


-- 5) RLS (leitura pública; escrita só service_role) -----------
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches public read" ON public.matches;
CREATE POLICY "matches public read" ON public.matches
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.online_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "snapshots public read" ON public.online_snapshots;
CREATE POLICY "snapshots public read" ON public.online_snapshots
  FOR SELECT TO anon, authenticated USING (true);


-- 6) RPCs -----------------------------------------------------
-- Filtro de período (Fase 3): as RPCs sensíveis a período aceitam
-- p_from/p_to (date, BRT). NULL = sem limite (tudo). Os DROPs abaixo removem
-- as assinaturas ANTIGAS (sem args / p_days int) — senão o Postgres cria um
-- overload e fica com as duas versões. Idempotente (IF EXISTS).
DROP FUNCTION IF EXISTS public.dashboard_stats();
DROP FUNCTION IF EXISTS public.daily_stats(int);
DROP FUNCTION IF EXISTS public.matches_by_hour();
DROP FUNCTION IF EXISTS public.match_duration();
DROP FUNCTION IF EXISTS public.engagement();
DROP FUNCTION IF EXISTS public.player_activity();

-- 6.1) dashboard_stats(p_from, p_to) — bloco `matches` reage ao período;
-- users/today/online/platforms são sempre "agora" (totais/foto atual).
CREATE OR REPLACE FUNCTION public.dashboard_stats(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result JSON;
  today date := public._brt_date(now());
  d_from date := COALESCE(p_from, '-infinity'::date);
  d_to date := COALESCE(p_to, 'infinity'::date);
BEGIN
  SELECT json_build_object(
    'users', json_build_object(
      'registered', (SELECT COUNT(*) FROM public.profiles),
      'anonymous_real', (
        SELECT COUNT(*) FROM public.players WHERE NOT is_bot AND user_id IS NULL
      ),
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
    'matches', (
      SELECT json_build_object(
        'total',          COUNT(*),
        'casual_online',  COUNT(*) FILTER (WHERE mode = 'casual_online'),
        'private_online', COUNT(*) FILTER (WHERE mode = 'private_online'),
        'matchmaking',    COUNT(*) FILTER (WHERE source = 'matchmaking'),
        'human_vs_human', COUNT(*) FILTER (WHERE NOT p1_is_bot AND NOT p2_is_bot),
        'human_vs_bot',   COUNT(*) FILTER (WHERE (p1_is_bot OR p2_is_bot) AND NOT (p1_is_bot AND p2_is_bot))
      )
      FROM public.matches
      WHERE finished_at IS NOT NULL
        AND public._brt_date(created_at) BETWEEN d_from AND d_to
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
GRANT EXECUTE ON FUNCTION public.dashboard_stats(date, date) TO anon, authenticated;


-- 6.2) daily_stats(p_from, p_to) — FINALIZADAS + BRT + ativos. Série de dias
-- vem do range (default: últimos 30 dias).
CREATE OR REPLACE FUNCTION public.daily_stats(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH dias AS (
    SELECT g::date AS dia
    FROM generate_series(
      COALESCE(p_from, public._brt_date(now()) - 29)::timestamp,
      COALESCE(p_to,   public._brt_date(now()))::timestamp,
      '1 day'::interval
    ) g
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
GRANT EXECUTE ON FUNCTION public.daily_stats(date, date) TO anon, authenticated;


-- 6.3) player_activity(p_from, p_to) — uma linha por jogador humano no período
CREATE OR REPLACE FUNCTION public.player_activity(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT
      COALESCE(pr.username, pl.display_name, lado.client_id) AS usuario,
      (lado.user_id IS NOT NULL)                              AS cadastrado,
      COUNT(*)                                                AS partidas,
      MAX(lado.created_at)                                    AS ultima_partida
    FROM (
      SELECT p1_client_id AS client_id, p1_user_id AS user_id, created_at
        FROM public.matches
        WHERE NOT p1_is_bot
          AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
      UNION ALL
      SELECT p2_client_id AS client_id, p2_user_id AS user_id, created_at
        FROM public.matches
        WHERE NOT p2_is_bot
          AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
    ) lado
    LEFT JOIN public.players  pl ON pl.client_id = lado.client_id
    LEFT JOIN public.profiles pr ON pr.user_id   = lado.user_id
    GROUP BY usuario, cadastrado
    ORDER BY ultima_partida DESC
    LIMIT 200
  ) t;
$$;
GRANT EXECUTE ON FUNCTION public.player_activity(date, date) TO anon, authenticated;


-- 6.4) user_stats(p_user_id, p_client_id) — stats por jogador
CREATE OR REPLACE FUNCTION public.user_stats(
  p_user_id UUID DEFAULT NULL,
  p_client_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_matches', COUNT(*),
    'wins', COUNT(*) FILTER (WHERE
      ((p1_user_id = p_user_id AND p_user_id IS NOT NULL)
       OR (p1_client_id = p_client_id AND p_client_id IS NOT NULL))
      AND winner = 1
      OR
      ((p2_user_id = p_user_id AND p_user_id IS NOT NULL)
       OR (p2_client_id = p_client_id AND p_client_id IS NOT NULL))
      AND winner = 2
    ),
    'casual_online', COUNT(*) FILTER (WHERE mode = 'casual_online'),
    'private_online', COUNT(*) FILTER (WHERE mode = 'private_online'),
    'training_offline', COUNT(*) FILTER (WHERE mode = 'training_offline'),
    'vs_bots', COUNT(*) FILTER (WHERE
      ((p1_user_id = p_user_id AND p_user_id IS NOT NULL)
       OR (p1_client_id = p_client_id AND p_client_id IS NOT NULL))
      AND p2_is_bot
      OR
      ((p2_user_id = p_user_id AND p_user_id IS NOT NULL)
       OR (p2_client_id = p_client_id AND p_client_id IS NOT NULL))
      AND p1_is_bot
    ),
    'vs_humans', COUNT(*) FILTER (WHERE NOT p1_is_bot AND NOT p2_is_bot)
  ) INTO result
  FROM public.matches
  WHERE finished_at IS NOT NULL AND (
    (p_user_id IS NOT NULL AND (p1_user_id = p_user_id OR p2_user_id = p_user_id))
    OR
    (p_client_id IS NOT NULL AND (p1_client_id = p_client_id OR p2_client_id = p_client_id))
  );
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.user_stats(UUID, TEXT) TO anon, authenticated;


-- 6.5) online_hourly(p_hours) — série de online por hora
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


-- 6.6) matches_by_hour(p_from, p_to) — partidas por hora do dia (média)
CREATE OR REPLACE FUNCTION public.matches_by_hour(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH base AS (
    SELECT public._brt_hour(created_at) AS hora
    FROM public.matches WHERE finished_at IS NOT NULL
      AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
  ),
  dias AS (
    SELECT GREATEST(COUNT(DISTINCT public._brt_date(created_at)), 1) AS n
    FROM public.matches WHERE finished_at IS NOT NULL
      AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
  )
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.hora), '[]'::json) FROM (
    SELECT h AS hora,
           COALESCE(c.total, 0) AS total,
           ROUND(COALESCE(c.total, 0)::numeric / (SELECT n FROM dias), 2) AS media
    FROM generate_series(0, 23) h
    LEFT JOIN (SELECT hora, COUNT(*) AS total FROM base GROUP BY hora) c ON c.hora = h
  ) t;
$$;
GRANT EXECUTE ON FUNCTION public.matches_by_hour(date, date) TO anon, authenticated;


-- 6.7) match_duration(p_from, p_to) — média de lances e tempo
CREATE OR REPLACE FUNCTION public.match_duration(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT json_build_object(
    'avg_moves',   (SELECT ROUND(AVG(total_moves), 1)
                      FROM public.matches
                      WHERE finished_at IS NOT NULL AND finish_reason = 'goal' AND total_moves > 0
                        AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)),
    'avg_seconds', (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - created_at))))
                      FROM public.matches
                      WHERE finished_at IS NOT NULL AND finish_reason = 'goal'
                        AND finished_at > created_at
                        AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)),
    'sample',      (SELECT COUNT(*)
                      FROM public.matches
                      WHERE finished_at IS NOT NULL AND finish_reason = 'goal' AND total_moves > 0
                        AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date))
  );
$$;
GRANT EXECUTE ON FUNCTION public.match_duration(date, date) TO anon, authenticated;


-- 6.8) retention_d1(p_days) — % que voltou (jogou online) no dia seguinte
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


-- 6.9) engagement(p_from, p_to) — métricas de engajamento no período
CREATE OR REPLACE FUNCTION public.engagement(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH played AS (
    SELECT ident, COUNT(*) AS n FROM (
      SELECT COALESCE(p1_user_id::text, p1_client_id) AS ident
        FROM public.matches WHERE NOT p1_is_bot AND finished_at IS NOT NULL
          AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
      UNION ALL
      SELECT COALESCE(p2_user_id::text, p2_client_id) AS ident
        FROM public.matches WHERE NOT p2_is_bot AND finished_at IS NOT NULL
          AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
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
      AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
  ),
  -- "sessão" = mesmo jogador (ident) no mesmo dia. n = partidas naquela sessão.
  sessions AS (
    SELECT ident, public._brt_date(created_at) AS dia, COUNT(*) AS n FROM (
      SELECT COALESCE(p1_user_id::text, p1_client_id) AS ident, created_at
        FROM public.matches WHERE NOT p1_is_bot AND finished_at IS NOT NULL
          AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
      UNION ALL
      SELECT COALESCE(p2_user_id::text, p2_client_id) AS ident, created_at
        FROM public.matches WHERE NOT p2_is_bot AND finished_at IS NOT NULL
          AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
    ) z WHERE ident IS NOT NULL GROUP BY ident, public._brt_date(created_at)
  )
  SELECT json_build_object(
    'active_players',          (SELECT COUNT(*) FROM played),
    'avg_matches_per_active',  (SELECT ROUND(AVG(n), 1) FROM played),
    'pct_more_than_3',         (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE n > 3) / NULLIF(COUNT(*), 0), 1) FROM played),
    'matches_per_session',     (SELECT ROUND(AVG(n), 1) FROM sessions),
    'recurring_players',       (SELECT COUNT(*) FROM (SELECT ident FROM sessions GROUP BY ident HAVING COUNT(DISTINCT dia) >= 3) r),
    'by_period', (
      SELECT COALESCE(json_object_agg(periodo, n), '{}'::json)
      FROM (SELECT periodo, COUNT(*) AS n FROM periodos GROUP BY periodo) p
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.engagement(date, date) TO anon, authenticated;


-- 6.10) match_outcomes(p_from, p_to) — abandono + win-rate humano vs bot ----
CREATE OR REPLACE FUNCTION public.match_outcomes(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL
)
RETURNS JSON LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  WITH base AS (
    SELECT finish_reason, winner, p1_is_bot, p2_is_bot, bot_difficulty
    FROM public.matches
    WHERE finished_at IS NOT NULL
      AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
  )
  SELECT json_build_object(
    'total',        (SELECT COUNT(*) FROM base),
    'abandoned',    (SELECT COUNT(*) FROM base WHERE finish_reason IN ('leave_wo', 'abandoned')),
    'abandono_pct', (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE finish_reason IN ('leave_wo', 'abandoned')) / NULLIF(COUNT(*), 0), 1) FROM base),
    -- Humano vence se winner = lado não-bot. p1 bot → humano é p2 (winner=2); etc.
    'human_winrate_vs_bot', (
      SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE (p1_is_bot AND winner = 2) OR (p2_is_bot AND winner = 1))
             / NULLIF(COUNT(*) FILTER (WHERE winner IS NOT NULL), 0), 1)
      FROM base WHERE (p1_is_bot OR p2_is_bot) AND NOT (p1_is_bot AND p2_is_bot)
    ),
    'winrate_by_difficulty', (
      SELECT COALESCE(json_object_agg(diff, obj), '{}'::json) FROM (
        SELECT bot_difficulty AS diff, json_build_object(
          'decided', COUNT(*) FILTER (WHERE winner IS NOT NULL),
          'human_winrate', ROUND(100.0 * COUNT(*) FILTER (WHERE (p1_is_bot AND winner = 2) OR (p2_is_bot AND winner = 1))
                            / NULLIF(COUNT(*) FILTER (WHERE winner IS NOT NULL), 0), 1)
        ) AS obj
        FROM base WHERE bot_difficulty IS NOT NULL GROUP BY bot_difficulty
      ) z
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.match_outcomes(date, date) TO anon, authenticated;


-- 6.11) retention_cohort(p_from, p_to) — D1/D7/D30 da coorte de cadastro -----
CREATE OR REPLACE FUNCTION public.retention_cohort(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL
)
RETURNS JSON LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  WITH cohort AS (
    SELECT COALESCE(user_id::text, client_id) AS ident, public._brt_date(created_at) AS d
    FROM public.players
    WHERE NOT is_bot
      AND public._brt_date(created_at) BETWEEN COALESCE(p_from, public._brt_date(now()) - 90) AND COALESCE(p_to, public._brt_date(now()))
  ),
  activity AS (
    SELECT DISTINCT ident, dia FROM (
      SELECT COALESCE(p1_user_id::text, p1_client_id) AS ident, public._brt_date(created_at) AS dia
        FROM public.matches WHERE NOT p1_is_bot AND finished_at IS NOT NULL
      UNION ALL
      SELECT COALESCE(p2_user_id::text, p2_client_id) AS ident, public._brt_date(created_at) AS dia
        FROM public.matches WHERE NOT p2_is_bot AND finished_at IS NOT NULL
    ) z WHERE ident IS NOT NULL
  ),
  ret AS (
    SELECT c.d,
      EXISTS (SELECT 1 FROM activity a WHERE a.ident = c.ident AND a.dia = c.d + 1)  AS r1,
      EXISTS (SELECT 1 FROM activity a WHERE a.ident = c.ident AND a.dia = c.d + 7)  AS r7,
      EXISTS (SELECT 1 FROM activity a WHERE a.ident = c.ident AND a.dia = c.d + 30) AS r30
    FROM cohort c
  )
  SELECT json_build_object(
    'cohort',  (SELECT COUNT(*) FROM cohort),
    'd1_pct',  (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE r1)  / NULLIF(COUNT(*) FILTER (WHERE d + 1  <= public._brt_date(now())), 0), 1) FROM ret),
    'd7_pct',  (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE r7)  / NULLIF(COUNT(*) FILTER (WHERE d + 7  <= public._brt_date(now())), 0), 1) FROM ret),
    'd30_pct', (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE r30) / NULLIF(COUNT(*) FILTER (WHERE d + 30 <= public._brt_date(now())), 0), 1) FROM ret)
  );
$$;
GRANT EXECUTE ON FUNCTION public.retention_cohort(date, date) TO anon, authenticated;


-- 6.12) conversion_rate(p_from, p_to) — anônimo → cadastrado ----------------
CREATE OR REPLACE FUNCTION public.conversion_rate(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL
)
RETURNS JSON LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT json_build_object(
    'total',     COUNT(*),
    'converted', COUNT(*) FILTER (WHERE user_id IS NOT NULL),
    'pct',       ROUND(100.0 * COUNT(*) FILTER (WHERE user_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1)
  )
  FROM public.players
  WHERE NOT is_bot
    AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date);
$$;
GRANT EXECUTE ON FUNCTION public.conversion_rate(date, date) TO anon, authenticated;


-- 6.13) heatmap_data(p_from, p_to) — partidas por hora × dia da semana ------
-- dow: 0=domingo .. 6=sábado (Postgres EXTRACT DOW), hora 0..23 (BRT).
CREATE OR REPLACE FUNCTION public.heatmap_data(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL
)
RETURNS JSON LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT EXTRACT(DOW FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS dow,
           public._brt_hour(created_at) AS hora,
           COUNT(*) AS total
    FROM public.matches WHERE finished_at IS NOT NULL
      AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
    GROUP BY 1, 2
  ) t;
$$;
GRANT EXECUTE ON FUNCTION public.heatmap_data(date, date) TO anon, authenticated;


-- 6.14) funnel(p_from, p_to) — visitou → jogou 1 → jogou 3+ → cadastrou -----
-- Coorte = jogadores não-bot criados no período.
CREATE OR REPLACE FUNCTION public.funnel(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL
)
RETURNS JSON LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  WITH cohort AS (
    SELECT COALESCE(user_id::text, client_id) AS ident, user_id
    FROM public.players
    WHERE NOT is_bot
      AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
  ),
  mc AS (
    SELECT ident, COUNT(*) AS n FROM (
      SELECT COALESCE(p1_user_id::text, p1_client_id) AS ident FROM public.matches WHERE NOT p1_is_bot AND finished_at IS NOT NULL
      UNION ALL
      SELECT COALESCE(p2_user_id::text, p2_client_id) AS ident FROM public.matches WHERE NOT p2_is_bot AND finished_at IS NOT NULL
    ) z WHERE ident IS NOT NULL GROUP BY ident
  )
  SELECT json_build_object(
    'visited',    (SELECT COUNT(*) FROM cohort),
    'played1',    (SELECT COUNT(*) FROM cohort c WHERE EXISTS (SELECT 1 FROM mc m WHERE m.ident = c.ident AND m.n >= 1)),
    'played3',    (SELECT COUNT(*) FROM cohort c WHERE EXISTS (SELECT 1 FROM mc m WHERE m.ident = c.ident AND m.n >= 3)),
    'registered', (SELECT COUNT(*) FROM cohort WHERE user_id IS NOT NULL)
  );
$$;
GRANT EXECUTE ON FUNCTION public.funnel(date, date) TO anon, authenticated;


-- 6.15) matchmaking_wait_times(p_from, p_to) — espera (s) por hora ----------
CREATE OR REPLACE FUNCTION public.matchmaking_wait_times(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL
)
RETURNS JSON LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  WITH base AS (
    SELECT public._brt_hour(created_at) AS hora, wait_ms
    FROM public.matches
    WHERE source = 'matchmaking' AND wait_ms IS NOT NULL
      AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
  )
  SELECT json_build_object(
    'overall_seconds', (SELECT ROUND(AVG(wait_ms) / 1000.0, 1) FROM base),
    'sample',          (SELECT COUNT(*) FROM base),
    'by_hour', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.hora), '[]'::json) FROM (
        SELECT h AS hora,
               ROUND(AVG(b.wait_ms) / 1000.0, 1) AS avg_seconds,
               COUNT(b.wait_ms) AS n
        FROM generate_series(0, 23) h
        LEFT JOIN base b ON b.hora = h
        GROUP BY h
      ) t
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.matchmaking_wait_times(date, date) TO anon, authenticated;


-- 6.16) bot_stats(p_from, p_to) — métricas de partidas vs bot (Parte 4) -----
CREATE OR REPLACE FUNCTION public.bot_stats(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL
)
RETURNS JSON LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  WITH vbot AS (
    SELECT finish_reason, finished_at, created_at, bot_difficulty, p1_is_bot, p2_is_bot, p1_name, p2_name
    FROM public.matches
    WHERE finished_at IS NOT NULL
      AND (p1_is_bot OR p2_is_bot) AND NOT (p1_is_bot AND p2_is_bot)
      AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
  ),
  vhum AS (
    SELECT finish_reason, finished_at, created_at
    FROM public.matches
    WHERE finished_at IS NOT NULL AND NOT p1_is_bot AND NOT p2_is_bot
      AND public._brt_date(created_at) BETWEEN COALESCE(p_from, '-infinity'::date) AND COALESCE(p_to, 'infinity'::date)
  )
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM vbot),
    'by_difficulty', (
      SELECT COALESCE(json_object_agg(bot_difficulty, n), '{}'::json)
      FROM (SELECT bot_difficulty, COUNT(*) AS n FROM vbot WHERE bot_difficulty IS NOT NULL GROUP BY bot_difficulty) z
    ),
    'abandono_vs_bot_pct',   (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE finish_reason IN ('leave_wo','abandoned')) / NULLIF(COUNT(*),0), 1) FROM vbot),
    'abandono_vs_human_pct', (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE finish_reason IN ('leave_wo','abandoned')) / NULLIF(COUNT(*),0), 1) FROM vhum),
    'avg_seconds_vs_bot',    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - created_at)))) FROM vbot WHERE finish_reason = 'goal' AND finished_at > created_at),
    'avg_seconds_vs_human',  (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - created_at)))) FROM vhum WHERE finish_reason = 'goal' AND finished_at > created_at),
    'top_names', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT nome, COUNT(*) AS n FROM (
          SELECT p1_name AS nome FROM vbot WHERE p1_is_bot AND p1_name IS NOT NULL
          UNION ALL
          SELECT p2_name AS nome FROM vbot WHERE p2_is_bot AND p2_name IS NOT NULL
        ) z GROUP BY nome ORDER BY n DESC LIMIT 10
      ) t
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.bot_stats(date, date) TO anon, authenticated;


-- 7) Backfills (idempotentes) ---------------------------------

-- Bots: o server cria perfis de bot com client_id 'bot-internal-<roomcode>'.
UPDATE public.players
  SET is_bot = true
  WHERE client_id LIKE 'bot-internal-%' AND NOT is_bot;

-- Link user_id por heurística display_name = username (o server linka via
-- handshake daqui pra frente; isto cobre quem já existia).
UPDATE public.players p
  SET user_id = pr.user_id
  FROM public.profiles pr
  WHERE p.display_name = pr.username
    AND p.user_id IS NULL
    AND NOT p.is_bot;

-- source das partidas antigas (antes da coluna existir) herda do mode.
UPDATE public.matches
  SET source = CASE WHEN mode = 'private_online' THEN 'private' ELSE 'lobby' END
  WHERE source IS NULL;


-- ============================================================
-- VERIFICAÇÃO (sem args = padrão/tudo; ou com range BRT):
--   SELECT public.dashboard_stats();                          -- tudo
--   SELECT public.dashboard_stats(CURRENT_DATE - 7, CURRENT_DATE); -- últimos 7d
--   SELECT public.daily_stats();                              -- últimos 30d
--   SELECT public.daily_stats(CURRENT_DATE - 6, CURRENT_DATE);
--   SELECT public.player_activity(CURRENT_DATE - 30, CURRENT_DATE);
--   SELECT public.matches_by_hour(CURRENT_DATE - 30, CURRENT_DATE);
--   SELECT public.match_duration(CURRENT_DATE - 30, CURRENT_DATE);
--   SELECT public.engagement(CURRENT_DATE - 30, CURRENT_DATE);
--   SELECT public.online_hourly(24);
--   SELECT public.retention_d1(30);
-- ============================================================
