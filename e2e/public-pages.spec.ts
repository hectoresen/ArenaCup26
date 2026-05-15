import { expect, test } from "@playwright/test";

/**
 * Golden paths de las páginas públicas (sin login). No cubrimos el
 * flujo OAuth — Google OAuth en E2E requiere credenciales dedicadas
 * que no merece la pena por ahora. Estos tests aseguran que:
 *  - El bundle carga.
 *  - El locale por defecto resuelve.
 *  - Las páginas marketing/legales/FAQ devuelven 200 y contenido.
 *  - El skip link a11y existe.
 *
 * Si alguno falla, el deploy tiene algo gordo roto (SSR/i18n).
 */

const PUBLIC_PATHS = [
  { path: "/", expect: /ranking|WebMundial/i },
  { path: "/es", expect: /WebMundial|ranking/i },
  { path: "/faq", expect: /preguntas|frequent/i },
  { path: "/legal/privacy", expect: /privacidad|privacy/i },
  { path: "/legal/terms", expect: /términos|terms/i },
  { path: "/status", expect: /estado|status/i },
];

for (const { path, expect: pattern } of PUBLIC_PATHS) {
  test(`GET ${path} returns 200 and recognizable content`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status(), `status of ${path}`).toBeLessThan(400);
    await expect(page.locator("body")).toContainText(pattern);
  });
}

test("skip-link is in DOM and points to #main-content", async ({ page }) => {
  await page.goto("/");
  const skip = page.locator('a[href="#main-content"]').first();
  await expect(skip).toBeAttached();
});

test("manifest.webmanifest is served", async ({ page }) => {
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.name).toBe("WebMundial 26");
});

test("status endpoint returns a known shape", async ({ page }) => {
  const response = await page.request.get("/api/status");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty("status");
  expect(body).toHaveProperty("services.database");
  expect(["ok", "degraded", "down"]).toContain(body.status);
});
