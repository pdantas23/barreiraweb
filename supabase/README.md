# Migrations do Supabase

Todas as migrations de banco do Barreira vivem aqui (`supabase/migrations/`).
**Não usamos o Supabase CLI** — cada arquivo é aplicado **manualmente** no
**Supabase Dashboard → SQL Editor**, copiando o conteúdo inteiro. Os scripts são
idempotentes (`CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`), então rodar de
novo é seguro.

## Ordem de aplicação (cronológica pelo prefixo `YYYYMMDD`)

| Arquivo | O que faz |
|---|---|
| `20260603_friendship_system.sql` | Tabelas/RPCs do sistema de amizade |
| `20260604_friend_invite_links.sql` | Links de convite de amigo (token/expiração) |
| `20260605_analytics.sql` | **Analytics (consolidado).** Schema (`players` cols, `matches` com `source`/`total_moves`, `online_snapshots`), RLS e todas as RPCs (`dashboard_stats`, `daily_stats`, `player_activity`, `user_stats`, `online_hourly`, `matches_by_hour`, `match_duration`, `retention_d1`, `engagement`). Estado final — re-rodável do zero. |

## Convenção

- Nome: `YYYYMMDD_descricao_curta.sql`.
- Cada migration tem um cabeçalho comentado explicando o que faz e como verificar.
- **Acoplamento com deploy:** uma migration que adiciona coluna escrita pelo
  server (ex.: `matches.source` na phase8) precisa rodar **antes** do deploy do
  server correspondente — senão o INSERT falha.
