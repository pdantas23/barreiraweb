// =============================================================================
// auth-drive.ts — autorização OAuth2 do Google Drive (rodar UMA vez)
// =============================================================================
//
// Gera o refresh token que o record-games.ts usa pra enviar os vídeos pro Drive
// na conta do PRÓPRIO usuário (service account não tem quota no Drive pessoal).
//
// Pré-requisitos:
//   - scripts/oauth-credentials.json: o JSON do OAuth client (tipo "Desktop app"
//     ou "Web") baixado do Google Cloud Console — contém client_id/client_secret.
//
// Uso:
//   npx tsx scripts/auth-drive.ts
//
// Fluxo: imprime uma URL → você autoriza no navegador → é redirecionado (pode dar
// "página não encontrada", normal) → copia o `code` da URL → cola aqui → o
// refresh token é salvo em scripts/oauth-token.json.
// =============================================================================

import { createInterface } from "node:readline";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OAUTH_CREDENTIALS = join(__dirname, "oauth-credentials.json");
const OAUTH_TOKEN = join(__dirname, "oauth-token.json");
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

type OAuthCreds = {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
};

// Lê o oauth-credentials.json, aceitando os formatos { installed: {...} },
// { web: {...} } (como o Cloud Console exporta) ou o objeto direto.
const readCredentials = (): OAuthCreds => {
  if (!existsSync(OAUTH_CREDENTIALS)) {
    console.error(
      `✖ ${OAUTH_CREDENTIALS} não encontrado.\n` +
        '  Crie um OAuth client (tipo "Desktop app") no Google Cloud Console,\n' +
        "  baixe o JSON e salve nesse caminho.",
    );
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(OAUTH_CREDENTIALS, "utf8"));
  const c = raw.installed ?? raw.web ?? raw;
  if (!c.client_id || !c.client_secret) {
    console.error(`✖ ${OAUTH_CREDENTIALS} não tem client_id/client_secret.`);
    process.exit(1);
  }
  return { client_id: c.client_id, client_secret: c.client_secret, redirect_uris: c.redirect_uris };
};

// Pergunta no terminal e devolve a resposta (sem quebra de linha).
const ask = (question: string): Promise<string> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
};

// O `code` copiado da URL de redirect costuma vir percent-encoded (ex.: o `/`
// vira %2F). Decodifica com segurança; se não for um escape válido, usa o cru.
const normalizeCode = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const main = async (): Promise<void> => {
  const creds = readCredentials();
  const redirectUri = creds.redirect_uris?.[0] ?? "http://localhost";
  const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri);

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline", // pede refresh token
    prompt: "consent", // força retornar o refresh token mesmo se já autorizou antes
    scope: [DRIVE_SCOPE],
  });

  console.log("\n1) Abra esta URL no navegador e autorize o acesso ao Google Drive:\n");
  console.log(authUrl);
  console.log(
    `\n2) Após autorizar, o navegador vai pra ${redirectUri} ` +
      '(pode aparecer "página não encontrada" — é normal).\n' +
      "   Copie o valor do parâmetro `code` da URL (tudo entre `code=` e o próximo `&`).\n",
  );

  const code = normalizeCode(await ask("Cole o código de autorização: "));
  if (!code) {
    console.error("✖ Nenhum código informado.");
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      console.error(
        "\n✖ O Google não retornou um refresh_token.\n" +
          "  Revogue o acesso do app em https://myaccount.google.com/permissions\n" +
          "  e rode de novo (o prompt=consent força o refresh token).",
      );
      process.exit(1);
    }
    writeFileSync(OAUTH_TOKEN, `${JSON.stringify({ refresh_token: tokens.refresh_token }, null, 2)}\n`);
    console.log(
      `\n✓ Refresh token salvo em ${OAUTH_TOKEN}\n` +
        "  Pronto — o record-games.ts agora envia pro Drive sem abrir navegador.",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n✖ Falha ao trocar o código pelo token: ${msg}`);
    process.exit(1);
  }
};

main();
