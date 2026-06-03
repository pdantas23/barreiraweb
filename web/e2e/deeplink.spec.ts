import { test, expect } from "@playwright/test";
import { primePage, dismissConnError, ANDROID_UA } from "./support";

// Cenário 3 — deep link /sala/CODIGO em mobile (Android).
// A página de redirect é transparente: sem tela de loading/redirect visível.
// Sem o app instalado (headless), o scheme custom não abre nada e, após o
// timeout de 1.5s, o site assume o auto-join (cai na Home/lobby).

test.use({ viewport: { width: 412, height: 915 }, userAgent: ANDROID_UA });

test.beforeEach(async ({ page }) => {
  await primePage(page);
});

test("não exibe tela de loading/redirect e cai no site após o timeout", async ({
  page,
}) => {
  await page.goto("/sala/ABCD");

  // Nada de "carregando"/"redirecionando" visível — o redirect é transparente.
  await expect(page.getByText(/redirecion/i)).toHaveCount(0);
  await expect(page.getByText(/carregando o app/i)).toHaveCount(0);

  // Após o fallback de 1.5s + assentar a Home, o conteúdo do site aparece.
  // O auto-join roda em background (?join=ABCD, que a Home limpa da URL).
  await expect(page.getByLabel("Ver leaderboard")).toBeVisible({ timeout: 14_000 });
  // Saiu da rota /sala (não ficou preso na ponte de redirect).
  await expect(page).not.toHaveURL(/\/sala\//);

  await dismissConnError(page);
  await expect(page).toHaveScreenshot("deeplink-android.png");
});
