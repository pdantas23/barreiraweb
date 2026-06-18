import { defineConfig } from "vite";
import type { Connect, PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

const PRERENDER_DIR = path.resolve(__dirname, "../deploy/public");

// Mapeia uma rota (sem extensão) para o HTML estático correspondente em
// deploy/public. Cobre SÓ as páginas de conteúdo que NÃO têm rota React
// (/artigos, /artigos/<slug> e /suporte) — sem elas, o acesso direto quebra
// no dev/preview (não há nginx). As demais (/regras, /sobre, /termos, etc.)
// já têm componente React e funcionam no dev pela própria SPA, então ficam
// de fora pra não mudar o comportamento atual de desenvolvimento.
function prerenderFileFor(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/suporte") return "suporte.html";
  if (clean === "/artigos") return "artigos/index.html";
  const m = clean.match(/^\/artigos\/([a-z0-9-]+)$/);
  if (m) return `artigos/${m[1]}.html`;
  return null;
}

// Plugin de dev/preview: sem nginx local, as páginas de conteúdo estáticas
// (/artigos, /suporte, etc.) não resolveriam — /artigos e /suporte nem têm
// rota React. Este middleware serve o HTML de deploy/public no acesso direto
// (full reload), igual à produção. A navegação intra-app via React Router
// continua client-side (não passa por aqui), então as páginas com componente
// React seguem funcionando normalmente dentro do app.
function prerenderStaticPages(): PluginOption {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url || (req.method && req.method !== "GET")) return next();
    const pathname = req.url.split("?")[0];
    const rel = prerenderFileFor(pathname);
    if (!rel) return next();
    const file = path.join(PRERENDER_DIR, rel);
    if (!fs.existsSync(file)) return next();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(fs.readFileSync(file));
  };
  return {
    name: "barreira-prerender-static-pages",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), prerenderStaticPages()],
  envDir: path.resolve(__dirname, ".."),
  resolve: {
    alias: {
      "@barreira/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
});
