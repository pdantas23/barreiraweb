import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Config dedicada de testes (não puxa o tailwind plugin do build pra não
// processar CSS à toa). jsdom + Testing Library. Env vars de teste evitam o
// throw do supabase.ts (que exige VITE_SUPABASE_* no boot).
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Garante UMA única cópia de react/react-dom no teste — sem isso, o
    // componente resolve react de web/node_modules e o testing-library do
    // root, e os hooks quebram ("Cannot read properties of null").
    dedupe: ["react", "react-dom"],
    alias: {
      "@barreira/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      react: path.resolve(__dirname, "../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../node_modules/react-dom"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
      VITE_SERVER_URL: "http://localhost:3000",
    },
  },
});
