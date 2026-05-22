# Barreira

Jogo de tabuleiro 9x9 estilo **Quoridor** para iOS e Android, feito com Expo (React Native + TypeScript).

**Modos de jogo:**
- **Offline** — contra CPU com 3 níveis de dificuldade (fácil, médio, difícil)
- **Online** — multiplayer em tempo real via WebSocket (criar/entrar em salas, rematch, reconexão automática)

## Estrutura

```
barreira/
├── mobile/                     # App Expo (React Native + TS)
│   ├── app/
│   │   ├── _layout.tsx         # Root layout (Gesture, Drag, Audio, Profile providers)
│   │   ├── index.tsx           # Menu principal (abas Offline / Casual)
│   │   ├── game.tsx            # Partida offline vs CPU
│   │   ├── online.tsx          # Lobby online (criar/entrar sala)
│   │   ├── online-game.tsx     # Partida online multiplayer
│   │   └── privacy.tsx         # Política de privacidade
│   ├── src/
│   │   ├── components/         # Board, Piece, Wall, WallBank, DragLayer, modais, etc.
│   │   ├── hooks/              # useMenuMusic, useButtonSound, usePieceSound, useWallSound, etc.
│   │   ├── state/              # dragOverlay, audioSettings, profile (contexts)
│   │   ├── net/                # socket.ts, clientId.ts, api.ts
│   │   └── theme.ts            # Paleta de cores
│   ├── assets/                 # Ícone, splash, sons (piano.mp3, wall.wav, peao.wav, etc.)
│   ├── app.json                # Config Expo (bundle id, splash, ícones)
│   └── eas.json                # Profiles de build (dev, preview, production)
│
├── server/                     # Backend Node.js
│   ├── src/
│   │   ├── index.ts            # Express + Socket.io, handlers RPC
│   │   ├── lobby.ts            # Salas, matchmaking, reconexão, timeout (W.O.)
│   │   ├── botManager.ts       # Bots fantasma no lobby + bot rescue
│   │   ├── profiles.ts         # Identidade anônima via Supabase
│   │   └── db.ts               # Cliente Supabase
│   ├── scripts/                # Testes manuais (test-client, test-room, test-game, etc.)
│   └── ecosystem.config.cjs    # PM2 (produção)
│
├── shared/                     # Engine do jogo (puro TS, sem deps de RN)
│   └── src/
│       ├── engine.ts           # applyMove — estado autoritativo
│       ├── board.ts            # Grid 9x9, posições iniciais
│       ├── walls.ts            # Validação de paredes, BFS pathfinding
│       ├── moves.ts            # Movimentos válidos (reto + salto diagonal)
│       ├── types.ts            # PlayerId, Move, GameState, WallPlacement
│       ├── protocol.ts         # Mensagens Client↔Server
│       ├── serialization.ts    # GameState wire format
│       ├── easyOpponent.ts     # Bot fácil (top-K greedy)
│       ├── smartOpponent.ts    # Bot médio (greedy 1-ply BFS)
│       ├── minimaxOpponent.ts  # Bot difícil (minimax α-β depth 2)
│       └── randomOpponent.ts   # Bot aleatório (não usado no app)
│
├── deploy/                     # nginx config + docs de deploy no VPS
├── .env                        # Variáveis de ambiente (todas centralizadas aqui)
└── .env.example                # Template para deploy
```

## Como rodar

### Pré-requisitos

- Node.js 18+
- npm 9+
- Expo Go no iPhone (ou Xcode para simulador)

### Instalação

```bash
git clone https://github.com/paulovitortss/barreira.git
cd barreira
npm install
```

### Development

```bash
# Terminal 1 — servidor
npm run dev:server

# Terminal 2 — app mobile
npm run mobile
```

Escaneie o QR code com o Expo Go (iPhone na mesma rede Wi-Fi).

Se a rede bloqueia comunicação entre dispositivos:
```bash
cd mobile && npm run tunnel
```

### Simulador iOS (precisa de Xcode)

```bash
cd mobile && npm run ios
```

## Build para App Store

```bash
npm i -g eas-cli
eas login
cd mobile
eas build -p ios --profile production
eas submit -p ios --latest
```

O `bundleIdentifier` é `com.barreira.app` — configurado em [mobile/app.json](mobile/app.json).

Preencha `appleId`, `ascAppId` e `appleTeamId` em [mobile/eas.json](mobile/eas.json) antes de submeter.

## Variáveis de ambiente

Todas centralizadas no `.env` da raiz. Veja `.env.example` para referência.

| Variável | Descrição |
|----------|-----------|
| `EXPO_PUBLIC_SERVER_URL` | URL do servidor (usado pelo app mobile) |
| `PORT` | Porta do servidor Node (padrão: 3001) |
| `DISCONNECT_TIMEOUT_MS` | Tempo de espera para reconexão (padrão: 30000) |
| `NODE_ENV` | Ambiente (development/production) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key do Supabase (nunca commitar) |

## Deploy do servidor (VPS)

```bash
cd /var/www/barreira
npm install
mkdir -p server/logs
pm2 start server/ecosystem.config.cjs
```

Nginx config em `deploy/nginx/barreira.conf`. TLS via Let's Encrypt (`certbot --nginx`).

## Como jogar

- **Sua peça é a azul (ciano)**, parte de baixo. Objetivo: chegar em qualquer casa da linha de cima.
- **Tap numa casa verde** = mover (1 casa ortogonal, ou salto sobre o adversário).
- **Arrasta uma parede do banco** (H ou V) até a intersecção desejada. A parede fica azul-fantasma se o encaixe for legal; solte para confirmar.
- Você tem **10 paredes**. Não pode colocar parede que feche totalmente o caminho de qualquer jogador.

## Scripts úteis

```bash
npm run dev:server        # Servidor com hot-reload
npm run mobile            # App mobile (Expo LAN)
npm run typecheck:shared  # Typecheck da engine
npm run typecheck:server  # Typecheck do servidor
npm run test:game         # Simulação de partida completa
npm run test:reconnect    # Teste de reconexão
npm run play:bot          # Bot vs bot
```

## Troubleshooting

- **`Permission denied` no expo**: `chmod +x mobile/node_modules/.bin/*`
- **`Operation not permitted`** (macOS TCC): mover o projeto para fora de `~/Desktop`, `~/Documents` ou `~/Downloads`, ou liberar em System Settings → Privacy & Security → Files & Folders.
- **`unable to resolve module`**: `rm -rf node_modules && npm install`
