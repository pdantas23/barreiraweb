import { test, expect } from "@playwright/test";
import { primePage, gotoLobby } from "./support";

// Cenário 1 — modal do leaderboard (snapshot visual). Desktop.
//
// NOTA: o leaderboard da WEB não tem overlay/blur para anônimos (esse gate é
// exclusivo do app mobile). Por isso aqui capturamos o lobby com o ícone
// flutuante e o modal aberto com a tabela completa. A variação "com overlay"
// pedida no escopo é coberta nos testes do mobile, onde o overlay existe.

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
  await primePage(page);
});

test("lobby mostra o ícone flutuante (leaderboard não inline)", async ({ page }) => {
  await gotoLobby(page);

  await expect(page.getByLabel("Ver leaderboard")).toBeVisible();
  // Fechado: o cabeçalho do ranking não aparece inline.
  await expect(page.getByText("LEADERBOARD")).toHaveCount(0);

  await expect(page).toHaveScreenshot("lobby-com-icone.png");
});

test("clicar no ícone abre o modal com a tabela", async ({ page }) => {
  await gotoLobby(page);
  await page.getByLabel("Ver leaderboard").click();

  await expect(page.getByText("LEADERBOARD")).toBeVisible();
  await expect(page.getByText("alice")).toBeVisible();
  await expect(page.getByText("bob")).toBeVisible();

  await expect(page).toHaveScreenshot("modal-aberto.png");
});

test("clicar no X fecha o modal", async ({ page }) => {
  await gotoLobby(page);
  await page.getByLabel("Ver leaderboard").click();
  await expect(page.getByText("LEADERBOARD")).toBeVisible();

  await page.getByLabel("Fechar").click();
  await expect(page.getByText("LEADERBOARD")).toHaveCount(0);
});
