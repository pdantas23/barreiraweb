import { test, expect } from "@playwright/test";
import { primePage, gotoLobby, IPHONE_UA, ANDROID_UA } from "./support";

// Cenário 2 — regressão visual do layout do lobby em 3 viewports.
// Em todos: o leaderboard NÃO aparece inline e o ícone flutuante está visível.

test.beforeEach(async ({ page }) => {
  await primePage(page);
});

test.describe("desktop 1280x800", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("ícone flutuante visível, ranking não inline", async ({ page }) => {
    await gotoLobby(page);
    await expect(page.getByLabel("Ver leaderboard")).toBeVisible();
    await expect(page.getByText("LEADERBOARD")).toHaveCount(0);
    await expect(page).toHaveScreenshot("layout-desktop.png");
  });
});

test.describe("iPhone 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA });

  test("ícone flutuante visível, ranking não inline", async ({ page }) => {
    await gotoLobby(page);
    await expect(page.getByLabel("Ver leaderboard")).toBeVisible();
    await expect(page.getByText("LEADERBOARD")).toHaveCount(0);
    await expect(page).toHaveScreenshot("layout-iphone.png");
  });
});

test.describe("Android 412x915", () => {
  test.use({ viewport: { width: 412, height: 915 }, userAgent: ANDROID_UA });

  test("botões inferiores (Criar sala / Entrar com codigo) não são cortados", async ({
    page,
  }) => {
    await gotoLobby(page);
    await expect(page.getByLabel("Ver leaderboard")).toBeVisible();
    // Os botões do rodapé do lobby precisam estar inteiros dentro da viewport.
    await expect(page.getByRole("button", { name: "Criar sala" })).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Entrar com codigo" }),
    ).toBeInViewport();
    await expect(page).toHaveScreenshot("layout-android.png");
  });
});
