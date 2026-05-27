# Tasks

Backlog vivo do Barreira. A ordem reflete prioridade — o que está no topo é o mais urgente.

---

## Próximas

### 🚨 [Mobile] BLOQUEIO App Store — Rejeição 5.1.2(i) (26/05/2026)

Submission `9fea6ee4-b6b7-4120-b25e-551967dc0628`, v1.0 (2), revisado em iPad Air 11" (M3).
Apple alegou cookies + falta de ATT. Diagnóstico: o app não tem WebView/cookies/tracking/IDFA — o modal de "Política de Privacidade" do primeiro launch foi interpretado como cookie consent banner.

**Já feito no código** (commit pendente):
- Modal do primeiro launch removido em `mobile/app/index.tsx` (junto com `AsyncStorage`, `ScrollView`, estado `showPrivacy`, função `onAcceptPrivacy`, constante `PRIVACY_ACCEPTED_KEY` e estilo `privacyText`). Política continua acessível em Configurações → Política de Privacidade.
- Verificado: `privacy.tsx` (nativa), `privacy.html` (web standalone) e `Privacy.tsx` (SPA) não mencionam cookies.

**Próximos passos (manuais)**:

1. **Auditar App Privacy em App Store Connect** — em "App Privacy", garantir que nada esteja marcado como "Cookies" ou "Identifiers for tracking". O único dado é `client_id` aleatório → marcar como "Data Not Linked to You" / "Not Used to Track You".
2. **Bump de build no Expo** — incrementar `ios.buildNumber` (ou deixar o EAS auto-incrementar) e rodar `eas build --platform ios --profile production` no `mobile/`.
3. **Submit** — `eas submit --platform ios --latest` (ou via App Store Connect).
4. **Responder no Resolution Center** com o texto abaixo (em inglês, Apple reviewers respondem em inglês):

```
Hi App Review Team,

Thank you for the detailed feedback. We want to clarify that Barreira does NOT track users and does NOT collect cookies. We believe the rejection was triggered by a misinterpretation of a privacy disclosure modal as a cookie consent prompt. We have removed it entirely in the new build (1.0, build 3) to eliminate any ambiguity.

Specifically:

1. NO WebView. The app contains no WebView component and does not load any external web content. The "Privacy Policy" screen is a fully native React Native screen (see app/privacy.tsx).

2. NO cookies. The app does not set, read, or transmit cookies of any kind.

3. NO tracking, NO analytics, NO advertising SDKs. The app does not use Google Analytics, Facebook SDK, AdMob, or any third-party tracking framework. We do not collect IDFA. We do not link any data to a user's identity, and we do not share data with third parties.

4. Only data collected: a random session identifier (client_id) generated locally on the device to allow reconnection during online matches. It is not linked to user identity and is never used for tracking or advertising purposes. This is also reflected accurately in our App Privacy disclosure ("Data Not Used to Track You").

5. What changed in build 3: the first-launch privacy disclosure modal — which we believe was misread as a cookie consent banner — has been removed. The Privacy Policy is still accessible at any time via Settings > Privacy Policy inside the app.

Because we do not perform any user tracking as defined by Apple's policy, App Tracking Transparency is not applicable to this app.

Please let us know if you need any additional clarification.

Best regards,
Barreira team
```

---

1. **Modo Rankeada** — coluna `elo_ranqueada` separada (não reaproveitar `trofeus_casual`); pareamento por faixa; reset sazonal opcional.
2. **Recuperação de senha via email (Supabase)** — botão "Esqueci minha senha" em `Login.tsx` que chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: "<dominio>/reset-password" })`; nova rota/página `web/src/pages/ResetPassword.tsx` que lê o `access_token` do hash da URL e chama `supabase.auth.updateUser({ password })` pra finalizar a troca. No Supabase Dashboard: confirmar template de email em Authentication → Email Templates → "Reset Password" e a Site URL/Redirect URLs em Authentication → URL Configuration.
3. **[Web] Não autoplay da música no menu** — abrir o site e ouvir música sem ter pedido é desconfortável e foge da convenção web (browsers inclusive bloqueiam autoplay com som). Mobile/app pode manter o comportamento atual (autoplay é convenção em jogo nativo). Opções de fix no web: (a) default `musicEnabled = false` em `web/src/state/audioSettings.tsx` (mais simples — usuário liga no modal de Configurações se quiser), OU (b) só iniciar a música após primeira interação do usuário (mais elaborado — guardar `hasUserInteracted` no `AudioSettingsProvider` e gatear o `useMenuMusic`), OU (c) remover `useMenuMusic` do `Home.tsx` web inteiramente. Recomendado: (a) — preserva o toggle existente em Configurações sem mudar arquitetura.

> [AdSense] revisão já solicitada no painel em 2026-05-26 — aguardando resposta do Google (2–7 dias). Se aprovado, slot `9953596385` já está ativo em `web/src/ads/adsConfig.ts:24`. Se rejeitado de novo, anotar o motivo aqui e abrir nova task.

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

### 2026-05-26 — Deploy: SPA pra barreirajogo.com + nginx + prerender + drop-in

- **Domínio principal migrado**: `barreirajogo.com` (raiz) passa a servir a SPA. `jogue.barreirajogo.com` foi reduzido a redirect 301 → `https://barreirajogo.com$request_uri` (server block separado em `/etc/nginx/sites-available/barreira-web` no VPS, com blocos SSL do Certbot preservados).
- **nginx — SPA fallback + reverse proxy refinado** (`deploy/nginx/barreira.conf`): reescrita completa do server block 443. Locations exatas pra `/privacy`, `/suporte`, `/regras`, `/estrategias`, `/sobre`, `/ads.txt` servirem HTML/text estático direto do disco; `/socket.io/` e `/health` proxiam pro Node (3001); regex `~* \.(js|mjs|css|woff2?|...)$` cobre assets hashados do Vite com `Cache-Control immutable 1y`; `location /` faz `try_files $uri $uri/ /index.html` resolvendo o 404 do AdSense em `/regras`, `/login`, `/perfil`, etc. `index.html` servido com `no-store` pra a shell estar sempre fresca.
- **Prerender estático** (`deploy/public/regras.html`, `estrategias.html`, `sobre.html`): HTMLs standalone com meta tags completas (description, OG, Twitter, canonical), conteúdo textual integral (500+ palavras cada) e CTA "Jogar Agora" → `/`. Crawler do AdSense recebe o conteúdo direto no markup, sem depender de execução de JS.
- **Animação drop-in da parede** (`web/src/components/Wall.tsx` + `web/src/index.css`): novo keyframe `wallDropIn` (translateY −14px → 0 com overshoot em 70%) com `cubic-bezier(0.34, 1.56, 0.64, 1)` e `fill-mode both`. Só pra paredes reais — ghost preview continua estático.
- **dotenv loader corrigido** (`server/src/index.ts`): o `||` entre `dotenv.config()` nunca disparava o fallback (dotenv retorna objeto truthy mesmo em erro). Agora chama ambas as paths incondicionalmente — dotenv não sobrescreve env já setada, então é seguro. Antes o server rodava com `injected env (0)` e `PORT` default; agora `injected env (8)` corretamente.
- **VPS setup**: chave SSH no Mac sem passphrase (`ssh-keygen -t ed25519` + add ao keychain); `.env` da raiz `/var/www/barreira/` criado com `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (não vai pro git); `pm2 restart barreira-server` pra carregar o novo `.env` e a feature de troféus.
- **AdSense — revisão solicitada**: painel marcado com "Confirmo que corrigi os problemas" e "Pedir revisão" enviado. Aguardando retorno do Google.
- **`tsc --noEmit` zerado nos 3 workspaces** (`web/src/vite-env.d.ts` + ajuste no `Leaderboard.tsx`): adicionado o triple-slash `/// <reference types="vite/client" />` pra tipar `import.meta.env` (resolve 4 errors em `AdBanner.tsx`, `net/socket.ts`, `net/supabase.ts`); `IoTrophy` no `RankBadge` passou a usar `color={medal.iconColor}` em vez de `className={medal.color}` (`react-icons` não tipa `className`), com o `MEDAL_STYLE` ajustado pra guardar hex em vez de Tailwind class. `tsc --noEmit` no `web/`, `shared/` e `server/` agora compila limpo.

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
