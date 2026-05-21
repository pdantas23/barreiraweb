# Tasks

Backlog vivo do Barreira. A ordem reflete prioridade — o que está no topo é o mais urgente.

---

## Próximas

1. **Tela de fim de jogo** — revanche / voltar ao menu
2. **Funcionalidade real do ícone de perfil** — tela de configurações / avatar / estatísticas
3. **Som e haptics** — movimento, parede colocada, vitória
4. **Animação de movimento da peça** — transição suave em vez de teleporte
5. **Animação de queda da parede** — drop-in ao soltar
6. **Persistência local** — placar e histórico de partidas (AsyncStorage / SQLite)
7. **Modo Casual** — multiplayer não rankeado (requer backend ou P2P)
8. **Modo Rankeada** — ELO, contas, backend dedicado

---

## Futuro (nice-to-have)

- Salto diagonal quando há parede atrás do adversário (regra oficial Quoridor que falta em `moves.ts`)
- Testes unitários da engine (`engine.ts`, `walls.ts`, `moves.ts`) com Jest
- Cache de `shortestPathDistance` no `smartOpponent` para acelerar avaliação de paredes
- Alternar quem começa a partida no restart (hoje sempre P1)
- Acessibilidade: `accessibilityLabel` em casas, paredes e botões; tamanhos mínimos de toque
- AdMob real no espaço já reservado em `game.tsx` (`adContainer`)
- Unificar fonte de tamanhos: `theme.ts` calcula valores que ninguém usa; tudo deveria vir de `useResponsiveBoard`
- Tutorial / primeira partida guiada

---

## Histórico

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
