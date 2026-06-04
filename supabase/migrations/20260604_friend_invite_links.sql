-- ============================================================================
-- friend_invite_links — links de convite de amizade com token e expiração
-- ----------------------------------------------------------------------------
-- Substitui o /amigo/USERNAME (que nunca expirava). Agora o link carrega um
-- token opaco; ao ser resgatado, quem COMPARTILHOU vira o requisitante e quem
-- abriu o link só precisa aceitar. O token expira (TTL definido no server).
--
-- Só o server (service_role) cria/lê tokens — sem policy pro anon.
-- Idempotente: IF NOT EXISTS pra poder rodar de novo.
-- ============================================================================
create table if not exists public.friend_invite_links (
  token          text primary key,
  owner_username text not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null
);

-- Lookup do link ativo mais recente de um dono (reuso em vez de criar N tokens).
create index if not exists friend_invite_links_owner_idx
  on public.friend_invite_links (owner_username, expires_at desc);

alter table public.friend_invite_links enable row level security;
-- Sem policy: anon não lê nem escreve. Só o server via service_role.
