-- ============================================================================
-- Sistema de amizade + convites de partida + push + versão do app
-- ----------------------------------------------------------------------------
-- A chave de identificação é o `username` (já único em public.profiles).
-- O server acessa via service_role (bypassa RLS); as policies abaixo protegem
-- acesso direto pelo anon key (web/mobile só leem o que é seu).
--
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE pra poder rodar de novo.
-- ============================================================================

-- Helper: username do usuário autenticado atual (via profiles.user_id).
create or replace function public.current_username()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select username from public.profiles where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- profiles.last_played_at — usado pelo cron de reengajamento (Parte 6).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists last_played_at timestamptz;

-- ============================================================================
-- friendships — pedidos e amizades aceitas
-- ============================================================================
create table if not exists public.friendships (
  id                 uuid primary key default gen_random_uuid(),
  requester_username text not null,
  receiver_username  text not null,
  status             text not null default 'pending'
                       check (status in ('pending', 'accepted', 'declined')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Não pode haver dois registros para o mesmo par no mesmo sentido.
  constraint friendships_unique_pair unique (requester_username, receiver_username),
  -- Ninguém é amigo de si mesmo.
  constraint friendships_no_self check (requester_username <> receiver_username)
);

create index if not exists friendships_requester_idx
  on public.friendships (requester_username);
create index if not exists friendships_receiver_idx
  on public.friendships (receiver_username);
-- Lookups por status (lista de amigos aceitos / pedidos pendentes).
create index if not exists friendships_receiver_status_idx
  on public.friendships (receiver_username, status);

alter table public.friendships enable row level security;

-- Usuário só enxerga friendships em que participa.
drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own on public.friendships
  for select
  using (
    requester_username = public.current_username()
    or receiver_username = public.current_username()
  );

-- ============================================================================
-- friend_invites — convites de partida (expiram em 30s)
-- ============================================================================
create table if not exists public.friend_invites (
  id            uuid primary key default gen_random_uuid(),
  from_username text not null,
  to_username   text not null,
  room_code     text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '30 seconds')
);

create index if not exists friend_invites_to_idx
  on public.friend_invites (to_username);
create index if not exists friend_invites_pair_idx
  on public.friend_invites (from_username, to_username);

alter table public.friend_invites enable row level security;

drop policy if exists friend_invites_select_own on public.friend_invites;
create policy friend_invites_select_own on public.friend_invites
  for select
  using (
    from_username = public.current_username()
    or to_username = public.current_username()
  );

-- ============================================================================
-- invite_cooldowns — anti-spam: máx 2 convites não aceitos por par / 5 min
-- ============================================================================
create table if not exists public.invite_cooldowns (
  from_username text not null,
  to_username   text not null,
  invite_count  integer not null default 0,
  window_start  timestamptz not null default now(),
  primary key (from_username, to_username)
);

alter table public.invite_cooldowns enable row level security;
-- Sem policy de SELECT pro anon: só o server (service_role) mexe aqui.

-- ============================================================================
-- push_tokens — Expo push token por usuário/plataforma
-- ============================================================================
create table if not exists public.push_tokens (
  user_id      uuid not null references auth.users (id) on delete cascade,
  token        text not null,
  platform     text not null check (platform in ('ios', 'android')),
  updated_at   timestamptz not null default now(),
  last_push_at timestamptz,
  primary key (token)
);

create index if not exists push_tokens_user_idx
  on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Usuário pode gerenciar (ver/escrever) só os próprios tokens.
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- app_config — configs globais (min_version, latest_version, ...)
-- ============================================================================
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

alter table public.app_config enable row level security;

-- Leitura pública (o app precisa ler min_version/latest_version no boot).
drop policy if exists app_config_read_all on public.app_config;
create policy app_config_read_all on public.app_config
  for select
  using (true);

-- Valores iniciais (ajustar conforme a release atual publicada nas stores).
insert into public.app_config (key, value) values
  ('min_version', '1.0'),
  ('latest_version', '1.1')
on conflict (key) do nothing;
