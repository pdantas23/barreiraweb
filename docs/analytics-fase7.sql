-- ============================================================
-- Fase 7: RPCs do dashboard
-- ============================================================
-- Roda esse arquivo INTEIRO no Supabase Dashboard -> SQL Editor.
-- Idempotente (CREATE OR REPLACE). Não apaga dados.
--
-- O que faz:
-- 1. Estende dashboard_stats() com blocos `today` (visitas/novos do dia)
--    e `online` (última foto de presença da tabela online_snapshots).
-- 2. Cria player_activity(): lista por jogador (nome, cadastrado, nº de
--    partidas, última partida). Expõe só nome + contagens (sem IDs/emails),
--    porque a RPC é legível via anon key.
-- ============================================================

-- 1) dashboard_stats() estendido --------------------------------

CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'users', json_build_object(
      'registered', (SELECT COUNT(*) FROM public.profiles),
      'anonymous_real', (
        SELECT COUNT(*) FROM public.players
        WHERE NOT is_bot AND user_id IS NULL
      ),
      'bots', (SELECT COUNT(*) FROM public.players WHERE is_bot)
    ),
    'today', json_build_object(
      'visited', (SELECT COUNT(*) FROM public.players WHERE last_seen_at >= CURRENT_DATE),
      'new',     (SELECT COUNT(*) FROM public.players WHERE created_at  >= CURRENT_DATE)
    ),
    'online', (
      SELECT row_to_json(s) FROM (
        SELECT taken_at, online_total, online_in_lobby, online_in_game,
               registered_online, anonymous_online
        FROM public.online_snapshots
        ORDER BY taken_at DESC
        LIMIT 1
      ) s
    ),
    'matches', json_build_object(
      'total', (SELECT COUNT(*) FROM public.matches WHERE finished_at IS NOT NULL),
      'casual_online', (
        SELECT COUNT(*) FROM public.matches
        WHERE mode = 'casual_online' AND finished_at IS NOT NULL
      ),
      'private_online', (
        SELECT COUNT(*) FROM public.matches
        WHERE mode = 'private_online' AND finished_at IS NOT NULL
      ),
      'training_offline', (
        SELECT COUNT(*) FROM public.matches
        WHERE mode = 'training_offline'
      ),
      'human_vs_human', (
        SELECT COUNT(*) FROM public.matches
        WHERE NOT p1_is_bot AND NOT p2_is_bot AND finished_at IS NOT NULL
      ),
      'human_vs_bot', (
        SELECT COUNT(*) FROM public.matches
        WHERE (p1_is_bot OR p2_is_bot)
          AND NOT (p1_is_bot AND p2_is_bot)
          AND finished_at IS NOT NULL
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


-- 2) player_activity() ------------------------------------------
-- Uma linha por jogador humano (bots ignorados). Registrados agregam por
-- username; anônimos por display_name. Em partida vs bot só o humano conta.

CREATE OR REPLACE FUNCTION public.player_activity()
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
        FROM public.matches WHERE NOT p1_is_bot
      UNION ALL
      SELECT p2_client_id AS client_id, p2_user_id AS user_id, created_at
        FROM public.matches WHERE NOT p2_is_bot
    ) lado
    LEFT JOIN public.players  pl ON pl.client_id = lado.client_id
    LEFT JOIN public.profiles pr ON pr.user_id   = lado.user_id
    GROUP BY usuario, cadastrado
    ORDER BY ultima_partida DESC
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.player_activity() TO anon, authenticated;


-- 3) daily_stats(p_days) — série por dia ------------------------
-- novos jogadores (created_at), partidas (matches.created_at) e pico de
-- online (max online_total) por dia, nos últimos p_days dias.

CREATE OR REPLACE FUNCTION public.daily_stats(p_days int DEFAULT 30)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH dias AS (
    SELECT (CURRENT_DATE - g)::date AS dia
    FROM generate_series(0, GREATEST(p_days, 1) - 1) g
  ),
  novos AS (
    SELECT created_at::date AS dia, COUNT(*) AS n
    FROM public.players GROUP BY 1
  ),
  parts AS (
    SELECT created_at::date AS dia, COUNT(*) AS n
    FROM public.matches GROUP BY 1
  ),
  onl AS (
    SELECT taken_at::date AS dia, MAX(online_total) AS pico
    FROM public.online_snapshots GROUP BY 1
  )
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.dia DESC), '[]'::json) FROM (
    SELECT d.dia,
           COALESCE(n.n, 0)    AS novos,
           COALESCE(p.n, 0)    AS partidas,
           COALESCE(o.pico, 0) AS pico_online
    FROM dias d
    LEFT JOIN novos n ON n.dia = d.dia
    LEFT JOIN parts p ON p.dia = d.dia
    LEFT JOIN onl   o ON o.dia = d.dia
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.daily_stats(int) TO anon, authenticated;

-- ============================================================
-- VERIFICACAO:
--   SELECT public.dashboard_stats();
--   SELECT public.player_activity();
--   SELECT public.daily_stats(30);
-- ============================================================
