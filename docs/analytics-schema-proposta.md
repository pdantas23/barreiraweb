# Proposta: Analytics + observabilidade do banco

Documento de planejamento (2026-06-03). Escrito no fim da sessão pra continuar
na próxima — não execute esse SQL sem revisar primeiro.

## Objetivo

Responder 5 perguntas que hoje o banco não responde:

1. Quantos usuários online agora
2. Diferenciar bot / anônimo / cadastrado nas estatísticas
3. Quantas partidas cada usuário fez (mesmo sem cadastro, identificado pelo clientId)
4. Se ele jogou modo offline (treino vs computador)
5. Plataforma (iOS / Web / Android)

## Estado atual do banco (referência)

Tabelas:
- `auth.users` — gerenciada pelo Supabase Auth
- `public.profiles` — `user_id PK`, `username UNIQUE`, `accepted_terms_at`, `trofeus_casual`
- `public.players` — `client_id PK`, `display_name`, `last_seen_at`

RPCs:
- `email_from_username(p_username)` — pra login por username
- `increment_trofeus_casual(p_user_id, p_delta)` — pra premiar vitórias

## Mudanças propostas

### 1. Adicionar colunas em `players`

```sql
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_platform TEXT CHECK (last_platform IN ('web', 'ios', 'android'));

CREATE INDEX IF NOT EXISTS players_user_id_idx ON public.players(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS players_is_bot_idx ON public.players(is_bot);
```

⚠️ `user_id` na `players` permite associar clientId persistente (mobile/web) à conta
Supabase. Quando o user faz login, o server atualiza `players.user_id` com o auth.users.id.

### 2. Nova tabela `matches`

```sql
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT,                                 -- "DFDPKQ" pra casual, null pra offline
  mode TEXT NOT NULL CHECK (mode IN ('casual_online', 'private_online', 'training_offline')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  finish_reason TEXT CHECK (finish_reason IN ('goal', 'timeout_wo', 'leave_wo', 'abandoned')),
  winner SMALLINT CHECK (winner IN (1, 2)),       -- engine player id (1 ou 2), null se abandoned
  total_moves INTEGER DEFAULT 0,

  -- Player 1
  p1_client_id TEXT,
  p1_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  p1_is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  p1_platform TEXT CHECK (p1_platform IN ('web', 'ios', 'android')),

  -- Player 2
  p2_client_id TEXT,
  p2_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  p2_is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  p2_platform TEXT CHECK (p2_platform IN ('web', 'ios', 'android'))
);

CREATE INDEX matches_p1_client ON public.matches(p1_client_id);
CREATE INDEX matches_p2_client ON public.matches(p2_client_id);
CREATE INDEX matches_p1_user ON public.matches(p1_user_id);
CREATE INDEX matches_p2_user ON public.matches(p2_user_id);
CREATE INDEX matches_created_at ON public.matches(created_at DESC);
CREATE INDEX matches_mode ON public.matches(mode);
CREATE INDEX matches_finished_idx ON public.matches(finished_at) WHERE finished_at IS NOT NULL;
```

### 3. Tabela de snapshot do online (opcional)

Pra gráfico histórico de "usuários online ao longo do dia":

```sql
CREATE TABLE IF NOT EXISTS public.online_snapshots (
  taken_at TIMESTAMPTZ PRIMARY KEY DEFAULT now(),
  online_total INTEGER NOT NULL,
  online_in_lobby INTEGER NOT NULL,
  online_in_game INTEGER NOT NULL,
  registered_online INTEGER NOT NULL,    -- só os logados
  anonymous_online INTEGER NOT NULL      -- conectados sem auth
);

-- Limpa snapshots > 30 dias pra não inflar
CREATE INDEX online_snapshots_taken_at ON public.online_snapshots(taken_at DESC);
```

### 4. RLS policies

Tudo `SELECT` público pra dashboards:
```sql
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches public read" ON public.matches FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.online_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "online_snapshots public read" ON public.online_snapshots FOR SELECT TO anon, authenticated USING (true);
```

Escritas só pelo service_role (server), então não precisa policy de INSERT.

### 5. RPCs convenientes pro dashboard

```sql
-- Stats globais agregadas
CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'users', json_build_object(
      'registered', (SELECT COUNT(*) FROM profiles),
      'anonymous_real', (SELECT COUNT(*) FROM players WHERE NOT is_bot AND user_id IS NULL),
      'bots', (SELECT COUNT(*) FROM players WHERE is_bot)
    ),
    'matches', json_build_object(
      'total', (SELECT COUNT(*) FROM matches WHERE finished_at IS NOT NULL),
      'casual_online', (SELECT COUNT(*) FROM matches WHERE mode = 'casual_online' AND finished_at IS NOT NULL),
      'training_offline', (SELECT COUNT(*) FROM matches WHERE mode = 'training_offline'),
      'human_vs_human', (SELECT COUNT(*) FROM matches WHERE NOT p1_is_bot AND NOT p2_is_bot AND finished_at IS NOT NULL),
      'human_vs_bot', (SELECT COUNT(*) FROM matches WHERE (p1_is_bot OR p2_is_bot) AND NOT (p1_is_bot AND p2_is_bot) AND finished_at IS NOT NULL)
    ),
    'platforms', (
      SELECT json_object_agg(platform, total) FROM (
        SELECT last_platform AS platform, COUNT(*) AS total
        FROM players WHERE NOT is_bot AND last_platform IS NOT NULL
        GROUP BY last_platform
      ) sub
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO anon, authenticated;

-- Stats por user (busca por client_id OU user_id)
CREATE OR REPLACE FUNCTION public.user_stats(p_user_id UUID DEFAULT NULL, p_client_id TEXT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'total_matches', COUNT(*),
    'wins', COUNT(*) FILTER (WHERE
      (p1_user_id = p_user_id OR p1_client_id = p_client_id) AND winner = 1
      OR (p2_user_id = p_user_id OR p2_client_id = p_client_id) AND winner = 2),
    'casual_online', COUNT(*) FILTER (WHERE mode = 'casual_online'),
    'training_offline', COUNT(*) FILTER (WHERE mode = 'training_offline'),
    'vs_bots', COUNT(*) FILTER (WHERE (
      (p1_user_id = p_user_id OR p1_client_id = p_client_id) AND p2_is_bot
      OR (p2_user_id = p_user_id OR p2_client_id = p_client_id) AND p1_is_bot)),
    'vs_humans', COUNT(*) FILTER (WHERE
      NOT p1_is_bot AND NOT p2_is_bot)
  ) INTO result FROM matches
  WHERE finished_at IS NOT NULL AND (
    p1_user_id = p_user_id OR p2_user_id = p_user_id OR
    p1_client_id = p_client_id OR p2_client_id = p_client_id
  );
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_stats(UUID, TEXT) TO anon, authenticated;
```

## Mudanças no código (resumo)

### Server (`server/src/`)

1. **`profiles.ts`**: marcar `is_bot=true` ao criar perfil bot. Atualizar `last_platform` no `getOrCreateProfile` (handshake).
2. **Novo arquivo `matches.ts`**: helpers `insertMatch(roomInfo)` e `finalizeMatch(matchId, winner, reason, totalMoves)`. Chamados em `lobby.ts` ao iniciar/encerrar partida.
3. **`index.ts`**: 
   - Handshake pega `platform` do auth e propaga
   - Após `joinRoom`/`createRoom` quando sala vira `playing`, chama `insertMatch`
   - Em `gameOver` callback, chama `finalizeMatch`
   - Endpoint HTTP `GET /stats/live` que retorna `{ online, inGame, inLobby }` lendo da memória
   - Setinterval 30s: escreve `online_snapshots`
4. **Endpoint HTTP `POST /matches/offline-result`** pra cliente reportar partidas offline.

### Cliente web (`web/src/`)

1. **`net/socket.ts`**: enviar `platform: 'web'` no auth do handshake
2. **`hooks/useLocalGame.ts`** (offline): após `gameOver`, POST pra `/matches/offline-result` com info da partida

### Cliente mobile (`mobile/src/`)

1. **`net/socket.ts`**: enviar `platform: Platform.OS === 'ios' ? 'ios' : 'android'`
2. **`app/game.tsx`** (offline): após `gameOver`, fetch POST `/matches/offline-result`

## Ordem de implementação sugerida

1. **Fase 1 — Schema** (rápido, sem deploy)
   - Roda SQL do passo 1 (ALTER players) + 2 (CREATE matches) + 4 (RLS) + 5 (RPCs)
   - Backfill: marcar bots existentes (rodar UPDATE com client_id LIKE 'bot-internal-%')

2. **Fase 2 — Server marca bot** (deploy server)
   - `profiles.ts`: passa `isBot` quando cria perfil; insere `is_bot=true`
   - Deploy + restart pm2

3. **Fase 3 — Registrar partidas** (deploy server)
   - `matches.ts` helpers
   - `lobby.ts` chama em create/join/gameOver
   - Deploy + restart

4. **Fase 4 — Plataforma no handshake** (deploy web + mobile)
   - Cliente envia platform
   - Server grava em `players.last_platform` e `matches.pN_platform`

5. **Fase 5 — Offline tracking** (deploy web + endpoint server)
   - Endpoint HTTP
   - Cliente posta após partida offline

6. **Fase 6 — Live stats** (deploy server)
   - Endpoint `/stats/live`
   - Snapshot periódico

7. **Fase 7 — Dashboard UI**
   - Página `/admin/stats` no web (ou tela na home) que chama RPC `dashboard_stats`

## Decisões pendentes pra próxima sessão

- Tabela `online_snapshots` é necessária ou só `/stats/live` basta?
- Dashboard fica em rota protegida (só admins) ou pública pra todos verem?
- Modo `private_online` (sala privada) conta separado ou junto com `casual_online`?
- Quanto de histórico de snapshots manter? (30 dias? 90?)
