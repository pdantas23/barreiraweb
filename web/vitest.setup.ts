import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Cada teste começa com o DOM limpo (sem estado compartilhado entre testes).
afterEach(() => {
  cleanup();
});
