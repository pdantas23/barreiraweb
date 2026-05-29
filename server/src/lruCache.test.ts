import { describe, it, expect } from "vitest";
import { createLruCache } from "./lruCache.js";

describe("createLruCache", () => {
  it("get/set/has/delete básicos", () => {
    const c = createLruCache<number>(10);
    expect(c.get("a")).toBeUndefined();
    expect(c.has("a")).toBe(false);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    expect(c.has("a")).toBe(true);
    expect(c.size).toBe(1);
    c.delete("a");
    expect(c.has("a")).toBe(false);
    expect(c.size).toBe(0);
  });

  it("respeita o limite máximo de entradas (não cresce indefinidamente)", () => {
    const c = createLruCache<number>(3);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    c.set("d", 4); // estoura → remove a mais antiga ("a")
    expect(c.size).toBe(3);
    expect(c.has("a")).toBe(false);
    expect(c.has("b")).toBe(true);
    expect(c.has("d")).toBe(true);
  });

  it("evicção é LRU: acessar uma chave a torna recente e a poupa", () => {
    const c = createLruCache<number>(3);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    c.get("a"); // "a" vira a mais recente
    c.set("d", 4); // estoura → remove a menos recente, que agora é "b"
    expect(c.has("a")).toBe(true);
    expect(c.has("b")).toBe(false);
    expect(c.has("c")).toBe(true);
    expect(c.has("d")).toBe(true);
  });

  it("re-set de chave existente atualiza valor sem inflar o tamanho", () => {
    const c = createLruCache<number>(2);
    c.set("a", 1);
    c.set("a", 2);
    expect(c.size).toBe(1);
    expect(c.get("a")).toBe(2);
  });

  it("preserva valores null/0/falsy (não confunde com ausência)", () => {
    const c = createLruCache<number | null>(5);
    c.set("z", null);
    expect(c.has("z")).toBe(true);
    expect(c.get("z")).toBeNull();
  });
});
