# Barreira

Jogo de tabuleiro 9x9 estilo Quoridor, mobile (iOS/Android) via Expo.

**Modo atual:** single-player local — humano (P1, peça ciano, sai de baixo) vs CPU (P2, peça vermelha, sai de cima). Bot greedy 1-ply baseado em BFS (minimiza distância própria, maximiza a do oponente). Sem servidor, sem socket. Funciona offline.

Roadmap em [TASKS.md](TASKS.md).

## Estrutura

```
barreira/
├── README.md
├── TASKS.md                    # backlog vivo
└── mobile/                     # Expo (React Native + TS) — projeto único
    ├── app/
    │   ├── _layout.tsx         # root: GestureHandlerRootView + DragOverlayProvider + Stack
    │   ├── index.tsx           # menu inicial (MULTIPLAYER / JOGO LOCAL)
    │   └── game.tsx            # tela do jogo
    ├── app.json                # config Expo (bundle id, splash, ícones)
    ├── babel.config.js         # preset-expo + react-native-worklets/plugin
    ├── metro.config.js
    ├── tsconfig.json           # strict, alias @/* → src/*
    ├── assets/                 # icon, splash, adaptive-icon, favicon
    └── src/
        ├── theme.ts            # paleta de cores
        ├── hooks/
        │   └── useResponsiveBoard.ts   # tamanhos do board a partir da janela
        ├── state/
        │   └── dragOverlay.tsx         # Context com SharedValues do drag
        ├── components/
        │   ├── Board.tsx       # grid 9x9 + paredes absolutas + ghost
        │   ├── Square.tsx
        │   ├── Piece.tsx
        │   ├── Wall.tsx
        │   ├── WallBank.tsx    # gesture Pan que arrasta parede
        │   ├── DragLayer.tsx   # parede flutuante sob o dedo
        │   └── TurnIndicator.tsx
        └── game/               # regras puras, sem dependência de RN
            ├── types.ts        # PlayerId, Move, GameState, WallSet
            ├── board.ts        # 9x9, posições iniciais, helpers
            ├── walls.ts        # canPlaceWall, registerWall, BFS, neighbors
            ├── moves.ts        # getValidMoves (com salto sobre adversário)
            ├── engine.ts       # applyMove (validação completa, imutável)
            ├── smartOpponent.ts   # greedy 1-ply (em uso)
            └── randomOpponent.ts  # bot uniforme (não utilizado)
```

A separação `src/game/` (puro) × `src/components/` (UI) é proposital: regras são testáveis sem mockar RN, e a engine `applyMove` é autoritativa pra qualquer cliente futuro.

## Como rodar (macOS → iPhone)

### Atenção: TCC do macOS

Se o projeto estiver dentro de `~/Desktop`, `~/Documents` ou `~/Downloads`, o macOS bloqueia `exec` de scripts do `node_modules/.bin/` com `Operation not permitted`, mesmo que tudo esteja com `+x`. Duas saídas:

- **Mover o projeto pra fora dessas pastas** (recomendado): `mv ~/Desktop/Philip/empresa/barreira ~/dev/barreira`
- Ou: System Settings → Privacy & Security → Files & Folders → Terminal → ligar **Desktop Folder**, fechar o terminal com ⌘Q e reabrir.

### Primeira vez

```bash
cd ~/dev/barreira/mobile
npm install
```

### Dia a dia (Expo Go no iPhone físico)

1. Instale **Expo Go** pela App Store no iPhone.
2. Mac e iPhone na mesma rede Wi-Fi.
3. No Mac:
   ```bash
   cd ~/dev/barreira/mobile
   npx expo start --lan
   ```
4. Aponte a câmera do iPhone pro QR code → abre no Expo Go.

Se a rede bloqueia comunicação entre dispositivos (Wi-Fi corporativo, hotspot isolado):

```bash
npx expo start --tunnel
```

### Simulador iOS (precisa de Xcode)

```bash
npx expo start --ios
```

### Build standalone (.ipa para TestFlight / loja)

```bash
npm i -g eas-cli
eas login
eas build -p ios --profile preview     # ad-hoc, instala via QR
eas build -p ios --profile production  # TestFlight / App Store
```

O `bundleIdentifier` já está como `com.barreira.app` em [mobile/app.json](mobile/app.json).

### Troubleshooting

- **`Permission denied` no expo**: `chmod +x mobile/node_modules/.bin/*`
- **`bad interpreter: Operation not permitted`**: TCC — ver seção acima.
- **`unable to resolve module …`** depois de mexer em deps: `rm -rf node_modules && npm install`
- **Drag de parede com offset estranho**: ver comentário em [mobile/src/components/DragLayer.tsx](mobile/src/components/DragLayer.tsx).

## Como jogar

- **Sua peça é a azul (ciano)**, parte de baixo. Objetivo: chegar em qualquer casa da linha de cima.
- **Tap numa casa verde** = move (1 casa ortogonal, ou salto sobre o adversário se ele está adjacente sem parede entre vocês).
- **Arrasta uma parede do banco** (H ou V) até a intersecção desejada. A parede fica azul-fantasma se for um encaixe legal; solte pra confirmar.
- Você tem 10 paredes. Não pode colocar parede que feche totalmente o caminho de qualquer jogador (regra clássica do Quoridor — o app rejeita silenciosamente).
- CPU joga 700 ms depois do seu turno.
