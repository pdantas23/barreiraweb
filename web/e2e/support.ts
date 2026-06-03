import { type Page, expect } from "@playwright/test";

export const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
export const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

// Ranking fixo pra o leaderboard ficar determinístico (sem depender do
// Supabase real). supabase-js bate em GET /rest/v1/profiles.
const LEADERBOARD = [
  { username: "alice", trofeus_casual: 10 },
  { username: "bob", trofeus_casual: 5 },
  { username: "carol", trofeus_casual: 3 },
];

// Prepara a página pra screenshots estáveis e independentes de backend:
//  - suprime o modal de privacidade (1ª visita) e o promo de iOS;
//  - stub do Supabase (ranking fixo);
//  - aborta o socket.io → o lobby fica sem salas (estado vazio determinístico),
//    sem depender de um servidor rodando.
export async function primePage(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("privacy_accepted", "1");
      sessionStorage.setItem("barreira.ios_promo_shown", "1");
    } catch {
      /* storage indisponível — ignora */
    }
  });

  await page.route("**/rest/v1/profiles*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(LEADERBOARD),
    }),
  );

  await page.route("**/socket.io/**", (route) => route.abort());
}

// Fecha o popup de "Sem conexão" se ele aparecer. Sem backend, a 1ª listagem
// de salas estoura timeout (~8s) e mostra esse aviso — fechamos pra o lobby
// ficar limpo pros screenshots. Com backend rodando, o popup nem aparece.
export async function dismissConnError(page: Page) {
  // Sem backend, a 1ª listagem estoura timeout (~8s) e mostra "Sem conexão".
  // Em dev o StrictMode invoca o efeito 2x → dois popups escalonados, então
  // fechamos num laço até nenhum reaparecer. Com backend, nenhum aparece e o
  // 1º waitFor expira de cara — seguimos em frente.
  const ok = page.getByRole("button", { name: "OK" });
  for (let i = 0; i < 6; i++) {
    try {
      await ok.waitFor({ state: "visible", timeout: i === 0 ? 7_000 : 1_500 });
      await ok.click();
      await ok.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    } catch {
      break; // sem (mais) popup
    }
  }
}

// Abre a Home e espera o lobby assentar (ícone visível + popup de conexão
// fechado). O conteúdo é gateado até a 1ª listagem resolver.
export async function gotoLobby(page: Page) {
  await page.goto("/");
  await expect(page.getByLabel("Ver leaderboard")).toBeVisible({ timeout: 12_000 });
  await dismissConnError(page);
}
