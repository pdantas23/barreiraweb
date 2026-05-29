import { describe, it, expect } from "vitest";
import {
  validateCreateRoom,
  validateJoinRoom,
  validateListRooms,
  validateMove,
} from "./validation.js";

// Helper: a validação deve lançar LobbyError com code "invalid-payload".
const rejects = (fn: () => void) => {
  expect(fn).toThrowError(/invalid-payload/);
};

describe("validateCreateRoom", () => {
  it("aceita payload válido", () => {
    expect(() => validateCreateRoom({ hostName: "Alice", color: "cyan", isPrivate: false })).not.toThrow();
    expect(() => validateCreateRoom({ hostName: "X", color: "random", isPrivate: true })).not.toThrow();
  });

  it("rejeita payload não-objeto", () => {
    rejects(() => validateCreateRoom(null));
    rejects(() => validateCreateRoom("nope"));
    rejects(() => validateCreateRoom(undefined));
  });

  it("rejeita hostName ausente, vazio, não-string ou longo demais", () => {
    rejects(() => validateCreateRoom({ color: "cyan", isPrivate: false }));
    rejects(() => validateCreateRoom({ hostName: "", color: "cyan", isPrivate: false }));
    rejects(() => validateCreateRoom({ hostName: 123, color: "cyan", isPrivate: false }));
    rejects(() => validateCreateRoom({ hostName: "a".repeat(31), color: "cyan", isPrivate: false }));
  });

  it("rejeita color inválida", () => {
    rejects(() => validateCreateRoom({ hostName: "A", color: "roxo", isPrivate: false }));
    rejects(() => validateCreateRoom({ hostName: "A", color: 1, isPrivate: false }));
  });

  it("rejeita isPrivate não-booleano", () => {
    rejects(() => validateCreateRoom({ hostName: "A", color: "cyan", isPrivate: "yes" }));
    rejects(() => validateCreateRoom({ hostName: "A", color: "cyan" }));
  });
});

describe("validateJoinRoom", () => {
  it("aceita com e sem password", () => {
    expect(() => validateJoinRoom({ code: "ABC123", playerName: "Bob" })).not.toThrow();
    expect(() => validateJoinRoom({ code: "ABC123", playerName: "Bob", password: "secret" })).not.toThrow();
  });

  it("rejeita code ausente/vazio/longo demais (>10)", () => {
    rejects(() => validateJoinRoom({ playerName: "Bob" }));
    rejects(() => validateJoinRoom({ code: "", playerName: "Bob" }));
    rejects(() => validateJoinRoom({ code: "A".repeat(11), playerName: "Bob" }));
  });

  it("rejeita playerName ausente/longo demais (>30)", () => {
    rejects(() => validateJoinRoom({ code: "ABC123" }));
    rejects(() => validateJoinRoom({ code: "ABC123", playerName: "n".repeat(31) }));
  });

  it("rejeita password não-string ou longa demais (>50)", () => {
    rejects(() => validateJoinRoom({ code: "ABC123", playerName: "Bob", password: 999 }));
    rejects(() => validateJoinRoom({ code: "ABC123", playerName: "Bob", password: "p".repeat(51) }));
  });
});

describe("validateListRooms", () => {
  it("aceita objeto vazio, null e undefined", () => {
    expect(() => validateListRooms({})).not.toThrow();
    expect(() => validateListRooms(null)).not.toThrow();
    expect(() => validateListRooms(undefined)).not.toThrow();
  });

  it("rejeita payload primitivo (ex: string gigante)", () => {
    rejects(() => validateListRooms("x".repeat(1000)));
    rejects(() => validateListRooms(42));
  });
});

describe("validateMove", () => {
  it("aceita move de peça válido (0..80)", () => {
    expect(() => validateMove({ move: { kind: "piece", to: 0 } })).not.toThrow();
    expect(() => validateMove({ move: { kind: "piece", to: 80 } })).not.toThrow();
  });

  it("aceita move de parede válido", () => {
    expect(() => validateMove({ move: { kind: "wall", placement: { type: "h", interRow: 0, interCol: 7 } } })).not.toThrow();
    expect(() => validateMove({ move: { kind: "wall", placement: { type: "v", interRow: 7, interCol: 0 } } })).not.toThrow();
  });

  it("rejeita payload/move malformado", () => {
    rejects(() => validateMove(null));
    rejects(() => validateMove({}));
    rejects(() => validateMove({ move: null }));
    rejects(() => validateMove({ move: { kind: "teleporte" } }));
  });

  it("rejeita 'to' de peça fora do tabuleiro ou não-inteiro", () => {
    rejects(() => validateMove({ move: { kind: "piece", to: -1 } }));
    rejects(() => validateMove({ move: { kind: "piece", to: 81 } }));
    rejects(() => validateMove({ move: { kind: "piece", to: 3.5 } }));
    rejects(() => validateMove({ move: { kind: "piece" } }));
  });

  it("rejeita parede com type/intersecções inválidos", () => {
    rejects(() => validateMove({ move: { kind: "wall", placement: { type: "x", interRow: 0, interCol: 0 } } }));
    rejects(() => validateMove({ move: { kind: "wall", placement: { type: "h", interRow: 8, interCol: 0 } } }));
    rejects(() => validateMove({ move: { kind: "wall", placement: { type: "h", interRow: -1, interCol: 0 } } }));
    rejects(() => validateMove({ move: { kind: "wall", placement: { type: "h", interRow: 0 } } }));
    rejects(() => validateMove({ move: { kind: "wall" } }));
  });
});
