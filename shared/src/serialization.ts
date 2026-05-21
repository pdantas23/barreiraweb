import { initialState } from "./board";
import type { GameState, PlayerId, WallPlacement } from "./types";
import { createEmptyWalls, registerWall } from "./walls";

// === Por que esse arquivo existe? ===
// `WallSet` mantém `blockedAdj` e `occupiedInter` como `Set<string>` pra consulta O(1).
// `JSON.stringify` transforma Set em `{}` — perderíamos a informação ao mandar
// o estado pelo socket. A solução: enviar SÓ `placements[]` (que é serializável)
// e reconstruir os Sets do outro lado rodando `registerWall` em loop.
//
// Idempotência: deserialize(serialize(s)) === s pra qualquer estado válido.

// Forma "wire" do estado — tudo serializável via JSON puro.
export type SerializedGameState = {
  p1: number;
  p2: number;
  turn: PlayerId;
  placements: WallPlacement[];
  wallsLeft: Record<PlayerId, number>;
  winner: PlayerId | null;
};

export const serializeState = (state: GameState): SerializedGameState => ({
  p1: state.p1,
  p2: state.p2,
  turn: state.turn,
  placements: state.walls.placements,
  wallsLeft: { ...state.wallsLeft },
  winner: state.winner,
});

export const deserializeState = (wire: SerializedGameState): GameState => {
  // Reconstrói WallSet aplicando cada placement no set vazio.
  // Isso recria tanto `blockedAdj` quanto `occupiedInter` corretamente.
  let walls = createEmptyWalls();
  for (const placement of wire.placements) {
    walls = registerWall(walls, placement);
  }
  return {
    p1: wire.p1,
    p2: wire.p2,
    turn: wire.turn,
    walls,
    wallsLeft: { ...wire.wallsLeft },
    winner: wire.winner,
  };
};

// Helper pra usar no lado do server quando criar uma sala.
export const serializeInitialState = (): SerializedGameState =>
  serializeState(initialState());
