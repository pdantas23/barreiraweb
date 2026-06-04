-- ============================================================
-- Fase 1: Schema de analytics + observabilidade
-- ============================================================
-- Roda esse arquivo INTEIRO no Supabase Dashboard → SQL Editor.
-- Idempotente: pode rodar varias vezes sem quebrar nada.
--
-- O que faz:
-- 1. Adiciona colunas em `players` (is_bot, user_id, last_platform)
-- 2. Cria tabela `matches` com referencias a auth.users e players
-- 3. Cria tabela `online_snapshots` pra historico de online
-- 4. RLS: leitura publica, escrita so service_role (server)
-- 5. RPCs `dashboard_stats()` e `user_stats(user_id, client_id)`
-- 6. Backfill: marca como bot todos os players com client_id 'bot-internal-*'
-- ============================================================

-- 1) Colunas novas em players ---------------------------------

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS last_platform TEXT
    CHECK (last_platform IN ('web', 'ios', 'android'));

CREATE INDEX IF NOT EXISTS players_user_id_idx
  ON public.players(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS players_is_bot_idx
  ON public.players(is_bot);


-- 2) Tabela matches -------------------------------------------

CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT,                              -- "DFDPKQ" pra casual, NULL pra offline
  mode TEXT NOT NULL CHECK (mode IN ('casual_online', 'private_online', 'training_offline')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  finish_reason TEXT CHECK (finish_reason IN ('goal', 'timeout_wo', 'leave_wo', 'abandoned')),
  winner SMALLINT CHECK (winner IN (1, 2)),    -- engine player id; NULL se abandoned/draw
  total_moves INTEGER DEFAULT 0,

  p1_client_id TEXT,
  p1_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  p1_is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  p1_platform TEXT CHECK (p1_platform IN ('web', 'ios', 'android')),

  p2_client_id TEXT,
  p2_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  p2_is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  p2_platform TEXT CHECK (p2_platform IN ('web', 'ios', 'android'))
);

CREATE INDEX IF NOT EXISTS matches_p1_client_idx ON public.matches(p1_client_id);
CREATE INDEX IF NOT EXISTS matches_p2_client_idx ON public.matches(p2_client_id);
CREATE INDEX IF NOT EXISTS matches_p1_user_idx ON public.matches(p1_user_id);
CREATE INDEX IF NOT EXISTS matches_p2_user_idx ON public.matches(p2_user_id);
CREATE INDEX IF NOT EXISTS matches_created_at_idx ON public.matches(created_at DESC);
CREATE INDEX IF NOT EXISTS matches_mode_idx ON public.matches(mode);
CREATE INDEX IF NOT EXISTS matches_finished_idx
  ON public.matches(finished_at) WHERE finished_at IS NOT NULL;


-- 3) Tabela online_snapshots ----------------------------------

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


-- 4) RLS policies (leitura publica) ---------------------------

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches public read" ON public.matches;
CREATE POLICY "matches public read" ON public.matches
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.online_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "snapshots public read" ON public.online_snapshots;
CREATE POLICY "snapshots public read" ON public.online_snapshots
  FOR SELECT TO anon, authenticated USING (true);

-- Inserts/Updates so via service_role (server). Nao precisa policy explicita
-- — service_role bypassa RLS.


-- 5) RPC: dashboard_stats() -----------------------------------
-- Retorna JSON com numeros agregados pra dashboard.

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


-- 6) RPC: user_stats() ----------------------------------------
-- Aceita user_id (UUID) OU client_id (TEXT). Retorna stats do user.

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


-- 7) Backfill: marcar bots existentes -------------------------
-- O server cria perfis com client_id no formato 'bot-internal-<roomcode>'.
-- Atualiza is_bot=true pra todos.

UPDATE public.players
  SET is_bot = true
  WHERE client_id LIKE 'bot-internal-%' AND NOT is_bot;


-- 8) Backfill: linkar user_id de quem ja tem profile ---------
-- Se um player tem display_name = username de algum profile,
-- assumimos que sao a mesma pessoa (heuristica simples).
-- Server vai linkar corretamente no futuro via handshake.

UPDATE public.players p
  SET user_id = pr.user_id
  FROM public.profiles pr
  WHERE p.display_name = pr.username
    AND p.user_id IS NULL
    AND NOT p.is_bot;


-- ============================================================
-- VERIFICACAO — roda essas queries APOS o script pra conferir:
-- ============================================================
-- SELECT * FROM public.dashboard_stats();
--
-- SELECT is_bot, COUNT(*) FROM public.players GROUP BY is_bot;
--
-- SELECT last_platform, COUNT(*) FROM public.players
--   WHERE NOT is_bot GROUP BY last_platform;
--
-- SELECT mode, COUNT(*) FROM public.matches
--   GROUP BY mode; -- (provavelmente vazio ainda)
-- ============================================================
