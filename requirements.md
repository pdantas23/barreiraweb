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
- Botão de escudo (shield) no canto superior esquerdo da home screen permite acessar a política a qualquer momento.
- Rota registrada no `_layout.tsx`.

---

### 2. Remover aba Ranqueado (Guideline 4.2 — Minimum Functionality) — RESOLVIDO

**Problema:** Aba "Ranqueado" mostrava apenas "Em breve..." — Apple rejeita funcionalidade incompleta/placeholder.

**Solução:**
- Removidos completamente: componente `RankedTab`, item na bottom nav, tipo `"ranked"` do union `Tab`, e todos os estilos associados (`rankedWrap`, `rankedEmoji`, `rankedTitle`, `rankedSub`, `navBubbleDisabled`, `navLabelDisabled`, `navSoon`).
- A bottom nav agora mostra apenas Offline e Casual.

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
- Removido canal alpha do `mobile/assets/icon.png` usando composição com fundo branco (PIL/Python).
- Confirmado: 1024x1024px, `hasAlpha: no`.

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
