import { defineConfig } from "vitest/config";

// O server é ESM e importa módulos internos com extensão .js (ex:
// `from "./lobby.js"`), mas os arquivos são .ts. Esse plugin reescreve o
// specifier relativo `.js` → sem extensão pra o Vite resolver o .ts.
const stripJsExt = {
  name: "strip-js-ext-for-ts",
  enforce: "pre" as const,
  async resolveId(this: any, source: string, importer: string | undefined) {
    if (importer && source.startsWith(".") && source.endsWith(".js")) {
      const resolved = await this.resolve(source.slice(0, -3), importer, { skipSelf: true });
      if (resolved) return resolved;
    }
    return null;
  },
};

export default defineConfig({
  plugins: [stripJsExt],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
