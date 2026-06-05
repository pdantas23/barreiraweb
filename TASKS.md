# Tasks

Backlog vivo do Barreira. A ordem reflete prioridade — o que está no topo é o mais urgente.

---

## Próximas

1. **Modo Rankeada** — coluna `elo_ranqueada` separada (não reaproveitar `trofeus_casual`); pareamento por faixa; reset sazonal opcional.

> [AdSense] revisão já solicitada no painel em 2026-05-26 — aguardando resposta do Google (2–7 dias). Se aprovado, slot `9953596385` já está ativo em `web/src/ads/adsConfig.ts:24`. Se rejeitado de novo, anotar o motivo aqui e abrir nova task.

---

## Futuro (nice-to-have)

- AdMob real no mobile — hoje **inexistente** (sem lib, sem placeholder). Precisa integrar `react-native-google-mobile-ads` do zero e decidir onde mostrar (o antigo `adContainer` em `game.tsx` não existe mais).

---

## Histórico

### 2026-06-05 — Tutorial: primeira partida guiada (mobile) + fixes

Tutorial interativo (coach-marks sobre o tabuleiro real), **uma vez por dispositivo**, que **roda ANTES da tela inicial** na primeira abertura. Ensina jogando e termina deixando o usuário concluir a partida. Decisões: partida guiada interativa (não slides) + flag por dispositivo via AsyncStorage (reinstalar mostra de novo — aceito).

- **Persistência** (`mobile/src/state/tutorial.tsx`): provider espelhando `audioSettings.tsx`, key `tutorial_seen`, expõe `{ seen, loading, markSeen() }` + helper puro `shouldShowTutorial(seen, loading)`. Montado no `_layout.tsx`.
- **Gatilho ANTES da home** (`app/index.tsx`): na 1ª vez (`!seen && !loading`), a home faz `router.replace("/tutorial")` assim que a flag resolve, com guard de render (fundo neutro) pra não piscar a tela inicial. (Mudou da ideia original de disparar no "Jogar".) Item **"Rever tutorial"** nas Configurações.
- **Roteiro data-driven** (`mobile/src/tutorial/script.ts`): `TUTORIAL_STEPS` (intro → mover → objetivo → parede → regra → "agora jogue"), `scriptedOpponentMove` (oponente anda reto, previsível) e `allowedTargets` (interseção com lances válidos da engine, defensivo).
- **Coach-marks** (`mobile/src/components/TutorialOverlay.tsx`): banner com texto + dots de progresso + "Pular" + CTA; *gating* de toque por passo (reaproveita `getValidMoves`/`canPlaceWall`); labels de acessibilidade; sem animação essencial (reduce-motion ok).
- **Tela do tutorial** (`app/tutorial.tsx`): duas fases — **guiada** (coach-marks, oponente scriptado) e **livre** (partida até o fim contra o bot fácil, com `GameOverModal`). Oponente joga com **delay de 700ms** (`OPPONENT_THINK_MS`, igual ao `game.tsx`) — antes era instantâneo. Sem troféu (é local/offline; troféu só vem do servidor no casual online). `markSeen()` ao entrar na fase livre ou ao pular/sair.
- **Testes**: `tutorial.test.tsx` (persistência/flag/skip/storage falho), `script.test.ts` (roteiro/oponente legal/fluxo), `tutorial-gate.test.tsx` (redireciona antes da home / já visto mostra home / loading não pisca). Suíte cheia verde (web 60 · server 114 · shared 65 · mobile 68).

**Fixes paralelos (mesma leva):**
- **Erro do refresh token no cold start** (`mobile/src/net/supabase.ts`): o `@supabase/auth-js` faz `console.error` interno quando o refresh token salvo está inválido (`GoTrueClient._recoverAndRefresh`) — mas já trata (remove sessão, emite SIGNED_OUT). Vazava um ERROR vermelho em produção. Filtro cirúrgico silencia **só** essa mensagem; qualquer outro erro passa.
- **QR do Expo Go no `npm run dev`** (`mobile/scripts/start-with-qr.mjs` + `package.json` raiz/mobile): rodando sob `concurrently` o stdout não é TTY → o Expo não desenha o QR. Wrapper sobe `expo start --lan`, faz polling no `/status` e, quando o Metro está pronto, imprime um QR estático de `exp://<IP-LAN>:8081` (IP recalculado a cada boot) com margem pra sobreviver ao prefixo `[mobile]`. Sem hotkeys i/a/r (pra isso, `npm --prefix mobile start` em terminal próprio).
- **Teste web stale** (`web/src/pages/Home.test.tsx`): atualizado pro troféu na navbar (não mais flutuante) + mock completo de `../net/api` pro `FriendsHub` (evita unhandled rejection que derrubava o exit code).

### 2026-06-05 — Ajustes pós-lançamento do Quick Match + troféu na navbar

Refinamentos em cima da Partida Rápida já entregue, além do reposicionamento do troféu:
- **Matchmaking — robustez e timing** (`server/src/matchmaking.ts` + overlays web/mobile): server passou a **ignorar `already-in-queue`** (re-entrada na fila não vira erro) e **`already-in-room`** no fluxo lobby+matchmaking; cold-start não dispara mais modal de erro. Timeout da fila virou faixa **12–20s** (antes fixo) e o contador é **regressivo**. Tempo exibido ganhou **jitter** e o "~" do contador foi removido (parece mais "real").
- **Troféu na navbar** (web): movido pra navbar **à esquerda do username**, removido o indicador flutuante anterior.
- **Troféu no mobile**: aparece **só no lobby**, não na tela inicial.

### 2026-06-05 — Partida Rápida (Quick Match) entregue

Matchmaking estilo Clash Royale: card "Partida Rápida" no lobby → tela de busca → fila; acha humano vira sala privada, senão cai num bot (medium/hard 50/50). 7 tasks, todas concluídas (regra cumprida: TASK 6 só foi implementada após a TASK 5 reportada e aprovada).
- **UI card** (`web/src/components/QuickMatchCard.tsx`/`Home.tsx`, `mobile/app/online.tsx`): card azul com ícone de raio, "Partida Rápida" / "Encontre um adversário em segundos" / "JOGAR →", acima da lista de salas.
- **Tela de matchmaking** (`web/src/components/MatchmakingOverlay.tsx` / Reanimated no mobile): fundo escuro animado, "Procurando adversário...", contador com avanço "orgânico", botão "Cancelar".
- **Server** (`server/src/matchmaking.ts`): fila; 2 reais → sala privada + `matchFound`; sem par → sala com bot. Eventos `joinMatchmaking`/`leaveMatchmaking`/`matchFound`/`matchmakingStatus`. Anti-spam: 1 fila por vez.
- **Nomes de bot realistas** (`shared/src/botNames.ts`): ≥80 nomes BR + `getRandomBotName()` sem repetição simultânea, substituindo `anonimo####`.
- **Expiração de salas de bot ociosas** (TASK 5 estudo → TASK 6 impl): `createdAt` na sala (`lobby.ts`); `reapExpiredBotRooms` piggyback no scan de 4s do `botManager` remove salas de bot *waiting* > 3min (`BOT_ROOM_TTL_MS`, env-config), zero timers novos. Matchmaking não afetado (privadas/playing).
- **Testes** (TASK 7): matchmaking 7 + `botNames` 4 + expiração 2, tudo verde.

### 2026-06-05 — Cache do bot investigado e DESCARTADO (sem ganho)

Tentativa de cachear/memoizar o BFS do bot (`shared/src/bot.ts`). Medido empiricamente com simulação determinística bot-vs-bot (fingerprint das jogadas idêntico antes/depois — comportamento preservado). **Nenhuma variante deu speedup mensurável**, então tudo foi revertido:
- `WeakMap<WallSet, …>` por config de paredes pro `shortestPathDistance`: hit rate só **~11%** — o hot path (~258k chamadas/partida-hard) vem do `wallIncreasesDist` avaliando paredes em `WallSet` descartáveis (objeto único por chamada, nunca dá hit). Overhead do cache anulou o ganho.
- Cache do `distFieldToGoal` por `(walls, targetRow)`: hit rate bom (**63%**), mas o BFS já é barato → ganho dentro do ruído.
- Trocar `registerWall`+BFS por BFS com 2 arestas extras (evita copiar Sets): também sem efeito.
- Medição min-of-trials: baseline ~1643–1688ms vs modificado ~1648–1659ms (1× hard+medium nos 2 turnos) — **indistinguíveis**.

Lição: o custo NÃO está no BFS (já otimizado com `Uint8Array`, vizinhos inline, early-return), e sim no overhead da busca (clonagem de estado no `applyMove`, `positionHash` montando string por nó, iteração do `generateMoves`). Um ganho real exigiria atacar isso — refactor maior, com risco de comportamento. Reforça [[bot-changes-validate-empirically]].

### 2026-06-05 — Acessibilidade do tabuleiro (mobile)

- **Tabuleiro com leitor de tela** (`Square.tsx`, `Board.tsx`/`AnimatedPawn`, `Wall.tsx`): casas que são jogada válida viram botões com label "Mover para coluna X, linha Y"; casas inertes saem do foco (`importantForAccessibility="no-hide-descendants"`) pra não virar 81 células de ruído. Peões expostos como imagem ("Peão azul/vermelho, coluna X, linha Y"). Paredes colocadas ganham label ("Parede horizontal/vertical do jogador azul/vermelho"); o ghost (preview de arraste) fica oculto do leitor.
- **Labels em botões só-ícone**: voltar (`game.tsx`, `online-game.tsx`), denunciar jogador, configurações (`TopBar.tsx`), perfil (`ProfileButton.tsx`).
- **Alvos de toque**: `hitSlop` nos botões pequenos (`FriendsButton` 36→~48, back/report/settings). *Obs: a auditoria tinha apontado "`FriendsButton` minWidth:16" — era o badge de notificação, não o botão (que já é 36×36).* Casas do tabuleiro ficam sem hitSlop de propósito (são adjacentes — expandir causaria toque na casa errada).

### 2026-06-05 — Limpeza do backlog (itens já concluídos)

Auditoria dos "nice-to-have" contra o código atual. Dois itens já estavam feitos e saíram da lista:
- **Testes unitários da engine** — feito (com vitest, não Jest). Há `*.test.ts` cobrindo `engine.ts`, `walls.ts`, `moves.ts`, `board.ts`, `bot.ts`, `serialization.ts` em `shared/src/`.
- **Alternar quem começa no restart** — feito. `randomFirstTurn()` (`shared/src/board.ts:31`) é usado em todo (re)início: server (`lobby.ts` start/rematch), jogo local mobile (`game.tsx` init/`onRestart`). Não é mais "sempre P1".

Além disso, feito o **cleanup do `theme.ts`**: removidos `BOARD_PADDING`/`BOARD_SIZE`/`CELL_SIZE`/`WALL_THICKNESS`/`WALL_LENGTH` (dead code — ninguém importava; `BOARD_SIZE` vem do `@barreira/shared` e o sizing real é do `useResponsiveBoard.ts`) e o import `Dimensions`. `theme.ts` ficou só com a paleta de cores.

### 2026-06-05 — Hardening de rate limit / anti-flood (server)

- **Anti-flood em memória** (`server/src/hardening.ts`, novo): janela deslizante por chave, tudo por-processo (sem Redis — cobre o deploy single-node atual). Limites configuráveis por env:
  - Conexões novas por IP/min (`RL_CONN_PER_MIN`, default 60) via `io.use()` — protege a tabela `players`, que ganha uma linha por `clientId` novo a cada conexão.
  - Eventos por socket numa janela de 10s (`RL_EVENTS_PER_10S`, default 120) checado no wrapper `rpc()` — barra spam de `createRoom`/`move`/etc.
  - Log `[flood]` quando alguém estoura; sweeper a cada 60s pra não vazar memória (`startHardeningSweeper`).
- **`server/src/index.ts`**: `maxHttpBufferSize: 64*1024` no socket + `express.json({ limit: "50kb" })` (corta payload gigante); `helmet()` + `express-rate-limit` (`RL_HTTP_PER_MIN`, default 120/min) no HTTP; `app.set("trust proxy", 1)` pro `X-Forwarded-For` real do nginx.
- **Protocolo + clientes**: novo `RpcError "rate-limited"` (`shared/src/protocol.ts`) com mensagem "Calma aí" no `web/src/net/errors.ts` e `mobile/src/net/errors.ts`.
- Mock do `io` em `server/src/wo-trophy.test.ts` ganhou `use: vi.fn()` (o `io.use` roda no load do módulo). 105 testes do server passando. Deploy feito (`pm2 restart` + rebuild web).

### 2026-06-05 — Fix reset de senha no web (link aparecia expirado)

- Bug: ao voltar do email de recuperação, o link caía em "link inválido/expirado". Causa: `web/src/net/supabase.ts` tinha `detectSessionInUrl: false`, então o SDK nunca processava os tokens do hash (`#access_token=...&type=recovery`) — `ResetPassword.tsx` não via sessão. A mensagem de "expirado" era nossa, não do Supabase; o token estava válido.
- Fix: `detectSessionInUrl: true` no cliente web. (Mobile segue `false` de propósito — lá os tokens chegam via deep link e são aplicados na mão com `setSession`.)

### 2026-06-05 — Analytics + observabilidade + dashboard admin + UX lobby

> Trabalho do Paulo (pdantas23) feito em cima do `777cb93`. O sistema de amizade
> do sócio veio depois, por cima disso. Resumo aqui pra contexto.

**Analytics — schema (Supabase, SQL em `docs/analytics-fase1.sql` e `docs/analytics-fase7.sql`):**
- `players` ganhou `is_bot`, `user_id` (FK `auth.users`), `last_platform`.
- Tabela nova `matches` — registro de partidas: `mode` (casual_online / private_online / training_offline), `winner`, `finish_reason` (goal / timeout_wo / leave_wo / abandoned), e p1/p2 com `client_id` / `user_id` / `is_bot` / `platform`.
- Tabela nova `online_snapshots` — foto da presença ao longo do tempo (podada > 30 dias).
- RLS: leitura pública (dashboards via anon key), escrita só service_role. RPCs `dashboard_stats()`, `player_activity()`, `daily_stats(p_days)`.
- ⚠️ **Bots NÃO entram em `players`** (clientId null) → `players.is_bot` fica sempre false; a contagem de bot que vale é `matches.pN_is_bot`.

**Server — vínculo de identidade + registro de partidas:**
- `profiles.ts`: `linkPlayerToUser(clientId, userId)` grava `players.user_id` no handshake do socket logado (separa anônimo de cadastrado nas métricas). `updatePlayerPlatform()` grava `last_platform`. Ambos fire-and-forget com cache LRU.
- Novo `matches.ts`: `recordMatchStart` / `recordMatchFinish` (UUID gerado no server, fire-and-forget). Wiring nos *callers* (`index.ts`, `botManager.ts`) pra `lobby.ts` ficar sem acoplamento com o DB. `ServerRoom.matchId` + `ServerPlayer.platform` novos.
- Novo `snapshots.ts` + loop a cada 60s (`SNAPSHOT_MS`) no `index.ts`: `computeOnlineStats()` lê `io.sockets.sockets` (dedup por clientId; bots fora) e grava `online_snapshots`.
- Handshake (`index.ts`) lê/valida `platform` do socket e propaga pra players e matches.

**Cliente — plataforma no handshake:**
- web e mobile `net/socket.ts` enviam `platform` no `auth` (`'web'` / `Platform.OS === 'ios' ? 'ios' : 'android'`).

**Web — dashboard admin (`web/src/pages/AdminStats.tsx`, rota `/admin/stats`):**
- Gate por email (`ADMIN_EMAILS`). Lê as 3 RPCs via anon key. Mostra: online agora, visitas/novos do dia, cards de agregados (cadastrados / anônimos / partidas / plataformas), tabela por jogador e tabela por dia (últimos 30).

**Web — Replay Builder recuperado:**
- `web/src/pages/ReplayBuilder.tsx` (+ `replayBuilder/coord.ts`, `parser.ts`, áudios em `web/public/audio/replay-builder/`) estava só numa stash e havia sumido do working tree — recuperado e commitado. Rota `/replay-builder` registrada **só em dev** (`import.meta.env.DEV`), não vai pro build de produção.

**Mobile — UX do lobby (`mobile/app/online.tsx`):**
- Troféu (leaderboard) movido do FAB flutuante (canto esquerdo) pra **dentro do header, ao lado do ícone de amigos**. Removida a folga `paddingTop: 44` que era reservada pro FAB (a lista de salas subiu); botão voltar alargado pra recentralizar o título "Lobby".

### 2026-05-28 — Auth nativa mobile + Replay web + bugs do lobby + UX

**Mobile — autenticação via deep link (sem signUp/signIn no app):**
- Cliente Supabase nativo (`mobile/src/net/supabase.ts`) com persistência via AsyncStorage. Singleton + `persistSession: true` + `autoRefreshToken: true` + `detectSessionInUrl: false` (deep link traz tokens manualmente).
- `AuthProvider` mobile (`mobile/src/state/auth.tsx`) espelha o da web: expõe `session`, `user`, `username`, `trofeusCasual`, `signOut`, `refreshTrofeus`, `setSessionFromTokens`. Listener `onAuthStateChange` chama `reconnectSocket()` em SIGNED_IN/OUT/TOKEN_REFRESHED/INITIAL_SESSION pra o server receber o novo access_token no próximo handshake.
- Tela `mobile/app/auth.tsx` — rota-ponte do deep link. Lê `access_token`/`refresh_token` via `useLocalSearchParams`, hidrata sessão, fecha `WebBrowser`, navega pra `/perfil`. Substitui o handler global anterior (que mostrava "Unmatched Route" porque o Expo Router roteava `/auth` como tela inexistente).
- Tela `mobile/app/perfil.tsx` — réplica nativa de `web/src/pages/Profile.tsx` (header PERFIL Bebas Neue, avatar com inicial, card de troféus, placeholder de stats, botão sair). Botão voltar usa `router.canGoBack()` — se chegou via deep link sem history, cai pra `router.replace("/")` em vez de "reiniciar o app".
- Site web (`web/src/net/deepLink.ts`, `web/src/pages/Login.tsx`, `Cadastro.tsx`) aceita `?from=app&redirect=<URL>`. Após signIn/signUp bem-sucedido, se veio do app, dispara `window.location.href = <redirect>?access_token=...&refresh_token=...`. Links internos do Login/Cadastro propagam os params via helper `withAppParams`.
- Socket mobile (`mobile/src/net/socket.ts`) agora envia `accessToken` no handshake via callback async (espelha a web): `supabase.auth.getSession()` + fallback `refreshSession()` se vier null antes do AsyncStorage carregar. Sem isso, cold start envia anônimo e o server não premia troféus.

**Mobile — TopBar full-width estilo web:**
- Novo componente `mobile/src/components/TopBar.tsx`: fundo branco edge-to-edge, logo BARREIRA em Bebas Neue (cor brand, letterSpacing 3) à esquerda, ícone perfil + engrenagem à direita. Status bar branca até o notch (`useSafeAreaInsets` no `paddingTop` da própria barra + `<StatusBar style="dark" backgroundColor="#FFF" translucent={false} />`).
- Pílula "Entrar / {username}" pequena com ícone — clique em logado vai pra `/perfil` (router.push), anônimo abre site no `expo-web-browser` com `?from=app&redirect=...`. Substitui o `floatingRow` antigo que ficava boiando sobre o gradiente.
- Bebas Neue carregada via `@expo-google-fonts/bebas-neue` no `_layout.tsx` (`useFonts`).

**Mobile — outras mudanças de UX:**
- Ícone central das tabs casual/treino (`mobile/app/index.tsx`): substituído wordmark "BARREIRA" + arena visual 6x6 com pawns/walls pelo `<Image source={require("../assets/icon.png")} resizeMode="contain" />`. Removidos os styles órfãos (`wordmark`, `logoSub`, `arenaOuter`, `arenaCard`, `arenaGrid`, `arenaCell`, `arenaPawn*`, `arenaWall*`).
- Música começa **desabilitada** por padrão (`mobile/src/state/audioSettings.tsx`): default `musicEnabled: false`. Só liga se o user salvou "1" explicitamente. SFX continua default true.
- Lobby reorganizado (`mobile/app/online.tsx`): `Leaderboard` no topo via `ListHeaderComponent` do `FlatList`, salas embaixo, tudo scroll junto. Footer (Entrar por código / Criar sala) fixo embaixo.
- `mobile/src/components/Leaderboard.tsx` (novo) lê top 10 de `profiles` via Supabase ANON_KEY (RLS permite leitura anônima). Medalha colorida 1–3, número simples 4+. Destaca usuário atual. Anônimos veem o card com `BlurView` (expo-blur) sobreposto + CTA "Entrar pra ver" que abre o site no in-app browser (mesmo fluxo da TopBar).
- Botão "Compartilhar sala" na waiting room (`mobile/app/online-game.tsx`): usa `Share.share()` nativo do RN. URL no formato `https://barreirajogo.com/?join=CODE[&pw=SENHA]`, mensagem multilinha com "Bora jogar Barreira?".

**Server — username real nas salas (web e mobile):**
- Bug: `createRoom`/`joinRoom` usavam `playerName` do cliente (sempre o `anonimoXXXX` da tabela `players`), mesmo com `authUserId` resolvido. Resultado: dois autenticados na mesma sala apareciam como anônimos.
- Fix (`server/src/profiles.ts` + `server/src/index.ts`): nova função `getUsernameForAuthUser(authUserId)` (`SELECT username FROM profiles` com cache em memória) e helper `resolvePlayerName(authUserId, clientName)` que devolve username se achou, senão fallback pro nome do cliente. Aplicado em ambos os handlers — server-side cobre web e mobile.

**Server — vinculação clientId↔conta (preparado, sem persistir):**
- Decisão original: usar accessToken no handshake é suficiente. Como `resolveAuthUser` já valida JWT e identifica o user, a tabela `account_clients` virou desnecessária pro fluxo básico.

**Lobby — auto-update em tempo real (web + mobile):**
- Novo evento `lobbyUpdated` em `shared/src/protocol.ts` (`ServerToClientEvents`).
- `server/src/lobby.ts`: callback `setOnLobbyChanged` + chamadas `notifyLobbyChanged()` em `createRoom`, `joinRoom`, `leaveRoom`, `finalizeTimeout`, `createBotHostRoom`, `addBotGuest`, `removeBotFromRoom` (filtrado por `wasWaiting` pra não disparar em transições de sala já playing/finished).
- `server/src/index.ts`: registra callback que faz `io.emit("lobbyUpdated")` global. Custo desprezível — quem não está no lobby ignora (listener não montado).
- `web/src/pages/Home.tsx` + `mobile/app/online.tsx`: listener no useEffect chama `refresh()`. Sem polling, sem timer.

**Bug "Sem conexão" no primeiro carregamento (web + mobile):**
- Diagnóstico: `safeRpc()` em `api.ts` chamava `emitWithAck` imediatamente após `connectSocket()`. O callback de auth do socket faz `await` em `supabase.auth.getSession()` + eventual `refreshSession()` (1–2s no cold start). Se o RPC dispara durante o handshake, o timeout de 8s estoura antes do server ver a mensagem.
- Fix (web/`src/net/socket.ts` + mobile/`src/net/socket.ts`): nova função `whenConnected(timeoutMs=6_000)` que resolve quando o socket conecta (ou rejeita após o timeout). `safeRpc()` agora aguarda `whenConnected()` antes do `fn()`. Toast só aparece após uma tentativa REAL falhar.

**Bug bot "instantâneo" no mobile (cache stale do gameStart):**
- Diagnóstico: ao voltar pro lobby via `router.back()`, `/online` não unmonta e o `useEffect` inicial não roda de novo. O `lastGameStart` no cache do socket guardava o gameStart de uma partida anterior. Próxima criação de sala → `/online-game` lia o cache → pulava direto pra "vs anônimoXXXX" como se o bot tivesse entrado imediato.
- Fix: `mobile/app/online.tsx` chama `clearLastGameStart()` no `useFocusEffect` (não só no mount). `mobile/app/online-game.tsx` consome o cache E limpa logo após — gameStart subsequentes (do server) chegam via listener.

**Bug toast "Caminho bloqueado" invertido pro guest no mobile:**
- `BlockedPathToast` renderiza dentro do `Board`, que pro P2 está com `transform: rotate(180deg)` no online. Toast herdava a rotação → texto de cabeça pra baixo.
- Fix análogo ao da web (commit `3173644`): nova prop `flipped?: boolean` em `BlockedPathToast` aplica `rotate: 180deg` no card + troca `top`↔`bottom` na posição absoluta. `Board.tsx` aceita e propaga; `online-game.tsx` passa `flipped={myPlayer === 2}`.

**Replay in-memory (apenas web, sem banco):**
- Captura dos moves: `shared/src/protocol.ts` — `StateUpdatePayload` ganhou `move?: Move` opcional. `server/src/index.ts` + `botManager.ts` incluem o `move` no broadcast de `stateUpdate` (humano e bot). Cliente empilha via listener.
- Estado in-memory: `useLocalGame` e `useOnlineGame` adicionam `replayMoves: Move[]` + `replayFirstTurn: PlayerId` (capturado no init / `onRestart` / `onGameStart`). Tudo `useState` — sai da rota e some.
- `web/src/components/ReplayModal.tsx` (novo) — modal sobreposto ao GameOverModal (z-index 300 > 200). Pré-computa todos os states com `useMemo([moves, firstTurn])` aplicando `applyMove` em cadeia. Controles ⏮ ⏯ ⏭ + slider `<input range>` 0..moves.length. Auto-play 600ms, pausa sozinho no fim, play rebobina se já estiver no fim. `flipped` mantém a perspectiva da partida pro P2.
- `web/src/components/GameOverModal.tsx`: novas props `replayAvailable` + `onWatchReplay`. Link sutil "Ver replay desta partida" com `IoPlayCircleOutline` abaixo das ações. Só aparece se houve ≥1 move (W.O. instantâneo não mostra).
- `web/src/components/GameOverlays.tsx`: gerencia o `showReplay` local pro modo offline. `web/src/pages/OnlineGame.tsx`: gerencia o `showReplay` direto pro online.

### 2026-05-26 — Fix race do authUserId no handshake (self-match continuava furando)

- Bug: `socket.data.authUserId` é setado via fire-and-forget após `resolveAuthUser` (HTTP pra Supabase). Se `createRoom`/`joinRoom` rodassem antes da resolução completar (refresh rápido, segundo socket logo após login), o handler via `null` e o guard de self-match não disparava — dois sockets do mesmo user passavam direto.
- Fix (`server/src/index.ts`): novo helper `ensureAuthUserId(socket)` que devolve o `authUserId` em cache OU aguarda o `resolveAuthUser` inline (cache-hit é instantâneo, miss adiciona ~1 round-trip). `accessToken` agora é guardado em `socket.data.accessToken` pra resolver depois. Handlers `createRoom`, `joinRoom` e `listRooms` viraram async e chamam `await ensureAuthUserId(socket)` antes de criar/buscar sala.

### 2026-05-26 — Compartilhar sala via WhatsApp + auto-join por link

- **Botão "Compartilhar no WhatsApp"** na tela de aguardando oponente (`web/src/pages/OnlineGame.tsx`): abre `wa.me/?text=...` com mensagem pré-preenchida ("Bora jogar Barreira? Sala: XYZ Senha: ABC Entre direto: https://barreirajogo.com/?join=XYZ&pw=ABC"). Botão secundário "Copiar link" usa `navigator.clipboard.writeText` com feedback "Copiado!" por 1.8s.
- **Auto-join via deep-link** (`web/src/pages/Home.tsx`): nova lógica detecta `?join=CODE[&pw=PWD]` na URL da Home, chama `joinRoom` automaticamente e redireciona pra `/online-game`. Self-match cai no popup existente (`errorPopup` via `errorInfo("self-match")`). Params são limpos da URL via `setSearchParams({}, { replace: true })` pra um refresh não re-disparar o join.

### 2026-05-26 — Bugs online: self-match, timer da revanche, trofeu, toast invertido + reset de senha

- **Self-match bloqueado** (`server/src/lobby.ts`): `joinRoom` agora rejeita com `self-match` quando `input.authUserId` bate com o `authUserId` do host. `listPublicRooms(excludeAuthUserId)` ganhou filtro pra esconder as próprias salas da lista de quick-play. Novo código `self-match` em `shared/src/protocol.ts` (`RpcError`), com mensagens amigáveis em `web/src/net/errors.ts` e `Home.tsx`.
- **Timer da revanche resetando** (`web/src/hooks/useOnlineGame.ts`): o `resetTimers` retornado por `useGameTimers` estava destructurado como `_resetTimers` — efetivamente unused. Agora é capturado via ref e chamado no `onGameStart`, então a revanche começa com tempo cheio e zera o `timedOutPlayer`.
- **Trofeu na revanche (race condition)** (`server/src/index.ts`): `awardCasualTrophy` era chamado com `void` (fire-and-forget) DEPOIS do `io.emit("gameOver")`. O cliente recebia o evento e chamava `refreshTrofeus` antes do INSERT terminar — lia o valor stale. Agora o handler de `move` é `async` e dá `await` no `awardCasualTrophy` antes do emit; mesma mudança no callback de timeout (W.O.).
- **Toast "Caminho bloqueado" invertido pro P2** (`web/src/components/BlockedPathToast.tsx`, `Board.tsx`, `GameLayout.tsx`): o `<Board>` é rotacionado 180° pro player 2 em `GameLayout`, e o `BlockedPathToast` (filho do Board) herdava a rotação — texto saía de cabeça pra baixo. Adicionado prop `flipped` que aplica `transform: rotate(180deg)` no container do toast pra contra-rotacionar.
- **Reset de senha via email** (Supabase): nova `useAuth().sendPasswordReset(email)` e `useAuth().updatePassword(newPassword)`. Botão "Esqueci minha senha" no `Login.tsx` → `/esqueci-senha` (nova página `ForgotPassword.tsx`) → `supabase.auth.resetPasswordForEmail` com `redirectTo: <origin>/reset-password`. Nova página `ResetPassword.tsx` escuta `PASSWORD_RECOVERY` do `onAuthStateChange`, valida sessão temporária, e chama `supabase.auth.updateUser({ password })`. Rotas registradas em `App.tsx`. Supabase Dashboard configurado (Redirect URL + email template).

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
