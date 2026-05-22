# Conformidade App Store — Status do Projeto

---

## O que ainda falta (ações pendentes)

### Pendente — Requer App Store Connect

| # | Ação | Guideline | Onde resolver |
|---|------|-----------|---------------|
| 1 | Declarar Privacy Nutrition Labels | 5.1.2 | App Store Connect → App Privacy. Declarar coleta de "Identifier" (o clientId gerado por instalação). Marcar como "Not Linked to User". |
| 2 | Declarar age rating correto | 3.0 | App Store Connect → Age Rating. Marcar "User Generated Content: Yes" (nomes visíveis) e "Unrestricted Web Access: No". |

### Pendente — Verificação manual recomendada

| # | Ação | Guideline | Observação |
|---|------|-----------|------------|
| 3 | Testar splash screen em todos os dispositivos | — | O `resizeMode: "contain"` está configurado. Recomenda-se testar no Simulator em diferentes telas (iPhone SE, Pro Max) para garantir que não há cortes. |

---

## O que já foi resolvido

### 1. Política de Privacidade in-app (Guideline 5.1.1) — RESOLVIDO

**Problema:** Apple exige política de privacidade acessível dentro do app.

**Solução:**
- Criada tela completa em `mobile/app/privacy.tsx` com todos os pontos exigidos (dados coletados, uso, compartilhamento, armazenamento, direitos, crianças, contato).
- Modal de consentimento aparece automaticamente na primeira abertura do app (usa AsyncStorage para persistir aceitação).
- Acessível a qualquer momento pelo modal de Configurações (engrenagem no canto superior esquerdo da home).
- Rota registrada no `_layout.tsx`.

---

### 2. Remover aba Ranqueado (Guideline 4.2 — Minimum Functionality) — RESOLVIDO

**Problema:** Aba "Ranqueado" mostrava apenas "Em breve..." — Apple rejeita funcionalidade incompleta/placeholder.

**Solução:**
- Removidos completamente: componente `RankedTab`, item na bottom nav, tipo `"ranked"` do union `Tab`, e todos os estilos associados.
- A bottom nav agora mostra apenas Treino e Casual.

---

### 3. Tratamento de erros de rede no modo Casual (Guideline 2.1) — RESOLVIDO

**Problema:** Se o servidor estivesse offline, as chamadas RPC travavam sem feedback ao usuário.

**Solução:**
- Adicionado wrapper `safeRpc()` em `mobile/src/net/api.ts` que aplica timeout de 8 segundos em todas as chamadas e captura erros de rede.
- Em caso de falha, retorna `{ ok: false, error: "internal-error", message: "Sem conexão com o servidor..." }`.
- Todos os Alerts no lobby (`online.tsx`) agora exibem `res.message` quando disponível, dando feedback claro ao usuário.

---

### 4. Ícone 1024x1024 sem canal alpha (Guideline 2.3.7) — RESOLVIDO

**Problema:** Apple exige ícone sem transparência (sem canal alpha). O `icon.png` era RGBA.

**Solução:**
- Novo ícone criado (tabuleiro 3D isométrico com peões e paredes, texto "BARREIRA").
- Center-crop de 1200x1200 para 1024x1024, RGB sem alpha.

---

### 5. Desabilitar suporte a iPad (Guideline 2.4.1) — RESOLVIDO

**Problema:** `supportsTablet: true` declarava suporte a iPad, mas a UI era otimizada só para iPhone. Apple testa em iPad.

**Solução:**
- Alterado `mobile/app.json`: `"supportsTablet": false`.
- Isso evita que o app apareça na App Store de iPad e impede teste Apple em iPad.

---

### 6. Mecanismo de report/denúncia de jogadores (Guideline 1.2) — RESOLVIDO

**Problema:** Modo online permite interação entre jogadores (nomes em salas). Apple pode exigir mecanismo de denúncia.

**Solução:**
- Adicionado botão de bandeira (flag) no top bar da tela de jogo online (`online-game.tsx`).
- Ao pressionar, exibe Alert de confirmação.
- Ao confirmar, abre email pré-preenchido para `contato@barreira.app` com dados da sala e nome do jogador denunciado.

---

### 7. HTTPS em produção (ATS) — JÁ ESTAVA OK

**Problema:** Apple bloqueia conexões HTTP não seguras.

**Solução:** O servidor de produção já usa HTTPS (`https://129-121-52-119.sslip.io`). O fallback `http://localhost:3000` só é usado em desenvolvimento local quando o `.env` não está presente — nunca em produção.

---

### 8. Sign in with Apple (Guideline 4.8) — NÃO NECESSÁRIO

O app não possui nenhum sistema de login/cadastro. Se login social for adicionado no futuro, Sign in with Apple se tornará obrigatório.

---

## Melhorias implementadas (além da conformidade)

### 9. Splash screen animado — RESOLVIDO

- Componente `SplashOverlay` em `mobile/src/components/SplashOverlay.tsx`.
- Sequência: tela preta → fade in do ícone (800ms) → hold (1.2s) → fade out (600ms) → app.
- Splash nativo do Expo com `backgroundColor: "#000000"` para transição suave.

---

### 10. Configurações de áudio — RESOLVIDO

- Modal de configurações acessível via ícone de engrenagem no canto superior esquerdo da home.
- Toggle para música de fundo (piano.mp3 no menu) e efeitos sonoros (botão, peão, parede).
- Preferências persistidas via AsyncStorage.
- Context global `AudioSettingsProvider` em `mobile/src/state/audioSettings.tsx`.

---

### 11. Música de fundo com crossfade loop — RESOLVIDO

- Dois players em paralelo (`useMenuMusic`) fazem crossfade de 3 segundos antes do fim da faixa.
- Transição imperceptível, sem gap nem clique entre loops.
- Música pausa automaticamente ao navegar para partida (via `useFocusEffect`) e retoma ao voltar.

---

### 12. Som de parede (wall.wav) — RESOLVIDO

- Hook `useWallPlaceSound` em `mobile/src/hooks/useWallSound.ts`.
- Toca `wall.wav` sempre que qualquer jogador (humano, CPU ou bot online) coloca uma parede.
- Integrado tanto no jogo offline (`game.tsx`) quanto online (`online-game.tsx`).

---

### 13. Fix envio duplicado de parede online — RESOLVIDO

- Guard `sendingWallRef` + reset síncrono de `dragTypeRef` no `onDragEnd` do `online-game.tsx`.
- Impede múltiplos `sendMove` disparados pelo gesto, eliminando warnings "not-your-turn".

---

### 14. Navbar redesenhada — RESOLVIDO

- Tabs "Treino" e "Casual" com animação de expansão (tab ativa cresce para cima com borda azul no topo).
- Sem bolha circular elevada — container inteiro da aba expande.
- Animação suave de 200ms (height, marginTop).
- Logo "BARREIRA" sem barras verticais na aba Casual.
