# Tasks

Backlog vivo do Barreira. A ordem reflete prioridade — o que está no topo é o mais urgente.

---

## Próximas

1. **[AdSense] Configurar SPA fallback no nginx do VPS** — sem isso, acessar `barreirajogo.com/regras`, `/estrategias` ou `/sobre` direto pela URL retorna 404, e o crawler do AdSense rejeita de novo. Adicionar `try_files $uri $uri/ /index.html;` no bloco `location /` da config nginx do VPS (não está no repo). Rotas atuais: `/`, `/game`, `/online`, `/online-game`, `/privacy`, `/regras`, `/estrategias`, `/sobre`, `/login`, `/cadastro`, `/termos`, `/perfil`.
2. **[AdSense] Deploy da versão saneada + pedir revisão** — `git push` + no VPS `git pull && cd web && npm install && npm run build`, depois marcar "Confirmo que corrigi os problemas" no painel de reprovação e clicar "Pedir revisão". Slot real `9953596385` já está no código (`web/src/ads/adsConfig.ts:24`).
3. **[AdSense] Prerender estático das páginas de conteúdo** — Google crawler executa JS, mas o ideal é servir HTML pronto. Avaliar `@prerenderer/rollup-plugin` (requer puppeteer ~170MB) ou solução leve via build-time script para `/regras`, `/estrategias`, `/sobre`, `/privacy`. Sem prerender, hoje só o `index.html` raiz tem meta tags.
4. **Animação de queda da parede** — drop-in ao soltar
5. **Modo Rankeada** — coluna `elo_ranqueada` separada (não reaproveitar `trofeus_casual`); pareamento por faixa; reset sazonal opcional

---

## Futuro (nice-to-have)

- Testes unitários da engine (`engine.ts`, `walls.ts`, `moves.ts`) com Jest
- Cache de `shortestPathDistance` no `smartOpponent` para acelerar avaliação de paredes
- Alternar quem começa a partida no restart (hoje sempre P1)
- Acessibilidade: `accessibilityLabel` em casas, paredes e botões; tamanhos mínimos de toque
- AdMob real no espaço já reservado em `game.tsx` (`adContainer`)
- Unificar fonte de tamanhos: `theme.ts` calcula valores que ninguém usa; tudo deveria vir de `useResponsiveBoard`
- Tutorial / primeira partida guiada

---

## Histórico

### 2026-05-25 — Troféus Casual + tela de Perfil

- Migration Supabase: dropada coluna `elo` de `public.profiles`, adicionada `trofeus_casual int not null default 0` + índice composto `(trofeus_casual desc, username asc)`. RPC `increment_trofeus_casual(p_user_id uuid, p_delta int)` SECURITY DEFINER (service_role-only) faz UPDATE atômico com guarda `GREATEST(0, …)`. SQL inteiro em `trofeus_casual.sql` na raiz.
- Server (`server/src/trophies.ts`, `auth.ts`): premiação fail-safe via RPC e validação de JWT por `supabase.auth.getUser` com cache TTL 5min. `ServerPlayer.authUserId` propaga no `createRoom`/`joinRoom`. Premiação +1 em vitória normal (`index.ts:298`) e W.O./timeout (`index.ts:152`). Bots ficam `authUserId=null`, casual-vs-bot conta pra quem está logado.
- Front (`web/src/net/socket.ts`): handshake passa a enviar `accessToken` da sessão Supabase via `auth` callback (re-avaliado a cada conexão). `AuthProvider` (`web/src/state/auth.tsx`) chama `reconnectSocket()` em `SIGNED_IN/OUT/TOKEN_REFRESHED` e expõe `trofeusCasual` + `refreshTrofeus()`. `useOnlineGame` chama `refreshTrofeus` quando recebe `gameOver` com `winner === myPlayer`.
- UI: `Leaderboard.tsx` lê e ordena por `trofeus_casual`. Nova rota `/perfil` (`Profile.tsx`) com avatar inicial, username, email, card de troféus e botão sair — resolve a antiga TASK #1 ("Funcionalidade real do ícone de perfil"). `HeaderAuthButtons.tsx` simplificado: clique no botão do usuário navega pra `/perfil` em vez de abrir modal.
- Test-game (`server/scripts/test-game.ts`): adicionado `setTimeout(3500)` após `gameStart` pra a primeira jogada não bater no bloqueio do countdown de 3s (regressão pré-existente desde `cfba39f`).

### 2026-05-25 — Saneamento AdSense (resposta à reprovação)

- Diagnóstico: violação "Anúncios em telas sem conteúdo do editor". Site era SPA puro de jogo, sem texto editorial em nenhuma rota além de `/privacy`.
- Novas páginas de conteúdo (500+ palavras cada): `web/src/pages/Regras.tsx`, `Estrategias.tsx`, `Sobre.tsx`. Rotas registradas em `App.tsx`.
- `Home.tsx`: botão "Regras" agora navega para `/regras` (modal removido); footer discreto com links para Regras · Estratégias · Sobre · Privacidade — todas crawláveis.
- `web/index.html`: removido `<script async ... adsbygoogle.js>` que carregava em telas sem ad. AdSense agora é carregado sob demanda via `AdBanner.ensureAdSenseScript()` apenas quando um ad é montado.
- `AdInterstitial.tsx` **deletado** — overlay no fim de partida era violação direta (tela comportamental sem conteúdo). `GameOverlays.tsx` limpo do código órfão.
- `GameLayout.tsx`, `Home.tsx`: removidos placeholders comentados de banners/sidebars na partida.
- `adsConfig.ts`: simplificado para um único slot `contentBanner`, com comentário deixando explícito que ads SOMENTE em páginas editoriais.
- `AdBanner` inserido em `/regras`, `/estrategias`, `/sobre` (no meio do conteúdo, formato horizontal).
- SEO: meta description, keywords, canonical, Open Graph, Twitter Cards em `index.html`. Criados `web/public/robots.txt` (bloqueando `/game`, `/online-game`, `/online`) e `web/public/sitemap.xml` (5 URLs editoriais).

### 2026-05-21 — Tela de fim de jogo + salto diagonal

- Componente `GameOverModal` — overlay com ícone (trophy/close), título colorido (ciano vitória, vermelho derrota), botões "Menu" e "Revanche", animações FadeIn/FadeInDown
- `game.tsx` — removido botão "Jogar de novo" + estilos órfãos; modal abre automaticamente quando `state.winner !== null`; "Menu" usa `router.back()`, "Revanche" chama `onRestart`
- Salto diagonal em `moves.ts` — quando o salto reto sobre o adversário está bloqueado (parede atrás OU borda), oferece as 2 casas perpendiculares ao movimento (regra oficial Quoridor)

### 2026-05-21 — Nova tela inicial + 3 dificuldades

- Home redesenhada — cards de modo, logo, glows, animações Reanimated
- Modal de dificuldade (Fácil / Médio / Difícil) com accent colorido e navegação
- Bot fácil (`easyOpponent.ts`) — sorteia entre TOP_K=6 melhores jogadas
- Bot difícil (`minimaxOpponent.ts`) — minimax α-β profundidade 2
- `game.tsx` lê dificuldade via query param, `pickBot()`, chip no topo
- Botão de perfil no canto superior direito (placeholder)
- Fix tipo `squares` em `Board.tsx` — eliminou erros `tsc`

### 2026-05-20 — Fundação do projeto

- Setup Expo (config, assets, tsconfig, babel, metro)
- Engine de regras: `types.ts`, `board.ts`, `walls.ts`, `moves.ts`, `engine.ts`
- Componentes base: `Square`, `Piece`, `Wall`, `TurnIndicator`
- Bot aleatório (`randomOpponent.ts`)
- Sistema de drag: `dragOverlay`, `DragLayer`, `WallBank`
- Bot greedy 1-ply (`smartOpponent.ts`)
- Responsividade: `useResponsiveBoard.ts`, `theme.ts`
- Layout raiz (`_layout.tsx`) e config Expo (`app.json`, `package.json`)
