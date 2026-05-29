import { describe, it, expect } from "vitest";
import { serializeState, deserializeState, serializeInitialState } from "./serialization";
import { applyMove } from "./engine";
import { initialState } from "./board";
import { isBlocked, neighbors } from "./walls";

describe("serialização — round-trip", () => {
  it("deserialize(serialize(s)) reproduz os escalares", () => {
    const s = initialState(2);
    const back = deserializeState(serializeState(s));
    expect(back.p1).toBe(s.p1);
    expect(back.p2).toBe(s.p2);
    expect(back.turn).toBe(s.turn);
    expect(back.winner).toBe(s.winner);
    expect(back.wallsLeft).toEqual(s.wallsLeft);
  });

  it("reconstrói o WallSet (blockedAdj/occupiedInter) a partir de placements", () => {
    // Aplica uma parede de verdade e serializa/desserializa.
    let s = initialState();
    const r1 = applyMove(s, 1, { kind: "wall", placement: { type: "h", interRow: 0, interCol: 0 } });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.state;

    const back = deserializeState(serializeState(s));
    // A adjacência bloqueada precisa sobreviver ao round-trip.
    expect(isBlocked(back.walls, 0, 9)).toBe(true);
    expect(isBlocked(back.walls, 1, 10)).toBe(true);
    expect(back.walls.placements).toHaveLength(1);
    // neighbors reflete a parede reconstruída.
    expect(neighbors(back.walls, 0)).toEqual([1]);
  });

  it("sobrevive a JSON.stringify/parse (formato wire real do socket)", () => {
    let s = initialState();
    const r = applyMove(s, 1, { kind: "wall", placement: { type: "v", interRow: 2, interCol: 3 } });
    if (!r.ok) throw new Error("setup");
    s = r.state;
    const wire = JSON.parse(JSON.stringify(serializeState(s)));
    const back = deserializeState(wire);
    expect(back.walls.placements).toHaveLength(1);
    expect(back.walls.placements[0]).toMatchObject({ type: "v", interRow: 2, interCol: 3 });
    // wallsLeft sobrevive (chaves viram strings no JSON mas indexação numérica funciona).
    // P1 colocou 1 parede → 9; P2 intacto → 10.
    expect(back.wallsLeft[1]).toBe(9);
    expect(back.wallsLeft[2]).toBe(10);
  });
});

describe("serializeInitialState", () => {
  it("produz o estado inicial com turn=1 (sem randomização)", () => {
    const wire = serializeInitialState();
    expect(wire.p1).toBe(76);
    expect(wire.p2).toBe(4);
    expect(wire.turn).toBe(1);
    expect(wire.placements).toEqual([]);
    expect(wire.winner).toBeNull();
  });
});
