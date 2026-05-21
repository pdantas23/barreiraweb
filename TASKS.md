# Tasks

Backlog vivo do Barreira. Este arquivo é atualizado conforme o produto evolui — itens entram, saem, mudam de prioridade. A ordem dentro de cada seção é, em geral, a ordem sugerida de execução.

Convenção:
- `[ ]` — pendente
- `[~]` — em andamento
- `[x]` — concluído (mantém aqui por algumas releases pra registro; depois vai pra `## Histórico`)

---

## Em andamento

_(vazio)_

---

## Próximos (curto prazo)

_(vazio — última leva entregue, ver Histórico)_

---

## Backlog (médio prazo)

- [ ] Funcionalidade real do ícone de perfil (tela de configurações / avatar / estatísticas)
- [ ] Modo **Casual** (multiplayer não rankeado) — requer backend ou matchmaking P2P
- [ ] Modo **Rankeada** — requer backend com ELO e contas
- [ ] Persistência de partidas e placar local (AsyncStorage / SQLite)
- [ ] Som e haptics (movimento, parede colocada, vitória)
- [ ] Animação de movimento da peça (não teleportar)
- [ ] Animação de queda da parede (drop in)
- [ ] Tela de fim de jogo com revanche / voltar pro menu

---

## Backlog (longo prazo / nice-to-have)

- [ ] Salto diagonal quando há parede atrás do adversário (regra oficial do Quoridor que falta em [mobile/src/game/moves.ts](mobile/src/game/moves.ts))
- [ ] Testes unitários da engine (`engine.ts`, `walls.ts`, `moves.ts`) com Jest
- [ ] Cache de `shortestPathDistance` no `smartOpponent` para acelerar avaliação de ~128 paredes
- [ ] Alternar quem começa a partida no restart (hoje sempre P1)
- [ ] Acessibilidade: `accessibilityLabel` em casas, paredes e botões; tamanhos mínimos de toque
- [ ] AdMob real no espaço já reservado em [mobile/app/game.tsx](mobile/app/game.tsx) (`adContainer`)
- [ ] Limpar fonte única de tamanhos: hoje [mobile/src/theme.ts](mobile/src/theme.ts) calcula `CELL_SIZE/WALL_LENGTH` que ninguém usa; tudo deveria vir de `useResponsiveBoard`
- [ ] Tutorial / primeira partida guiada

---

## Histórico

### 2026-05-21 — Nova tela inicial + 3 dificuldades

- [x] Home redesenhada ([mobile/app/index.tsx](mobile/app/index.tsx)) com 3 cards de modo (Usuário x CPU ativo; Casual e Rankeada com badge "EM BREVE"), logo composto por duas paredes cruzadas, glows decorativos, animações de entrada (Reanimated `FadeIn` / `FadeInDown` / `FadeInUp`).
- [x] Ícone de perfil no canto superior direito ([mobile/src/components/ProfileButton.tsx](mobile/src/components/ProfileButton.tsx)). Sem função real — abre `Alert` "Em breve".
- [x] Modal de dificuldade ([mobile/src/components/DifficultyModal.tsx](mobile/src/components/DifficultyModal.tsx)) com Fácil / Médio / Difícil. Cada opção tem accent colorido, descrição curta e radio. Botão **Jogar** navega pra `/game?difficulty=...`.
- [x] [mobile/app/game.tsx](mobile/app/game.tsx) lê `difficulty` via `useLocalSearchParams` e injeta o bot via `pickBot()`. Chip da dificuldade aparece no topo.
- [x] **Fácil** — novo [mobile/src/game/easyOpponent.ts](mobile/src/game/easyOpponent.ts): ranqueia todas as jogadas legais e sorteia entre as TOP_K=6 melhores. Comete erros pequenos sem parecer aleatório.
- [x] **Médio** — `smartOpponentMove` existente (greedy 1-ply).
- [x] **Difícil** — novo [mobile/src/game/minimaxOpponent.ts](mobile/src/game/minimaxOpponent.ts): minimax com alfa-beta profundidade 2; avaliação combina distância (BFS) e saldo de paredes; branching de paredes filtrado por raio Manhattan 2 em torno das peças pra controlar tempo de cálculo.
- [x] Pequeno ajuste em [mobile/src/components/Board.tsx](mobile/src/components/Board.tsx) anotando o tipo de `squares: ReactElement[]` (eliminou os dois erros pré-existentes do `tsc --noEmit`).
