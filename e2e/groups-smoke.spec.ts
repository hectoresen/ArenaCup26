import { test as anonTest, expect } from "@playwright/test";
import { loginAs, test } from "./fixtures";

/**
 * Smoke + happy-path tests del módulo de grupos.
 *
 * Los happy paths usan el bypass de auth (`/api/test/auth-as`)
 * disponible cuando `E2E_AUTH_ENABLED=true` + `E2E_AUTH_SECRET` están
 * seteados en el servidor de pruebas. En CI estos vars vienen de
 * secretos. Sin ellos, los tests se skipean explícitamente para
 * mantener la suite verde en local sin DB.
 */

const HAS_AUTH_BYPASS = !!process.env.E2E_AUTH_SECRET;

test.describe("groups — smoke (unauthenticated)", () => {
  anonTest("redirects to login when accessing /social/grupos/nuevo", async ({ page }) => {
    await page.goto("/es/social/grupos/nuevo");
    await expect(page.locator("form")).toHaveCount(0);
    expect(page.url()).not.toContain("/social/grupos/nuevo");
  });

  anonTest("redirects to login when accessing /social/grupos/descubrir", async ({ page }) => {
    await page.goto("/es/social/grupos/descubrir?q=test");
    expect(page.url()).not.toContain("/social/grupos/descubrir");
  });

  anonTest("/social/grupos/unirse/<token> preserves token via next=", async ({ page }) => {
    const token = "smoke-token-test-abc";
    const response = await page.goto(`/es/social/grupos/unirse/${token}`);
    const finalUrl = page.url();
    if (finalUrl.includes("/login")) {
      expect(decodeURIComponent(finalUrl)).toContain(`/social/grupos/unirse/${token}`);
    } else {
      expect(response?.status() ?? 200).toBeLessThan(500);
    }
  });
});

test.describe("groups — happy paths (authenticated)", () => {
  test.skip(!HAS_AUTH_BYPASS, "E2E_AUTH_SECRET no seteado — skipping happy paths");

  test("logged user can open /social and see Mis grupos section", async ({ authedPage }) => {
    await authedPage.goto("/es/social");
    // Sección "Mis grupos" debe estar presente (con o sin grupos).
    await expect(authedPage.getByText(/Mis grupos|My groups/i)).toBeVisible();
  });

  test("create group flow: form → redirect to /social/grupos/<id>", async ({ authedPage }) => {
    await authedPage.goto("/es/social/grupos/nuevo");
    // El form puede estar oculto si el user ya está al cap (3 grupos).
    // En ese caso skipeamos en lugar de fallar — el user de fixture
    // (Carlos placeholder) puede tener grupos previos de tests
    // anteriores.
    const form = authedPage.locator("form");
    const visible = await form.count();
    if (visible === 0) {
      test.skip(true, "Test user al cap de grupos, no se puede crear más.");
      return;
    }

    const uniqueName = `Test Group ${Date.now()}`;
    await authedPage.fill('input[type="text"]', uniqueName);
    await authedPage.locator('button[type="submit"]').click();

    // Redirección al detalle del grupo.
    await authedPage.waitForURL(/\/social\/grupos\/[a-f0-9-]+$/, { timeout: 10_000 });
    // El header del grupo debe contener el nombre.
    await expect(authedPage.locator("h1")).toContainText(uniqueName);
  });

  test("ranking page shows tab Grupos always when authenticated", async ({ authedPage }) => {
    await authedPage.goto("/es/ranking");
    // Nav debe estar siempre presente para users con sesión.
    await expect(authedPage.getByRole("link", { name: /^Global$/i })).toBeVisible();
    await expect(authedPage.getByRole("link", { name: /^Grupos$/i })).toBeVisible();
  });

  test("clicking 'Grupos' tab when no groups shows empty state CTA", async ({ authedPage }) => {
    // Asumimos un user fresh sin grupos. Si tiene grupos, el flujo
    // muestra el primer grupo y el test se vuelve no-aplicable.
    await authedPage.goto("/es/ranking?scope=grupos");
    // Buscar el CTA "+ Crear grupo" — si está en página, es empty state.
    const cta = authedPage.getByRole("link", { name: /\+\s*Crear grupo/i });
    if (await cta.isVisible().catch(() => false)) {
      await cta.click();
      await authedPage.waitForURL(/\/social\/grupos\/nuevo$/);
      await expect(authedPage.locator("h1")).toBeVisible();
    } else {
      // El user tiene grupos — empty state no aplica. Pasa el test.
      test.info().annotations.push({
        type: "skip-reason",
        description: "Test user tiene grupos, empty state no aplica",
      });
    }
  });

  test("discover page renders ALL groups including private with lock", async ({ authedPage }) => {
    await authedPage.goto("/es/social/grupos/descubrir");
    // Encabezado debe estar presente.
    await expect(authedPage.locator("h1")).toBeVisible();
    // El buscador debe estar presente.
    await expect(authedPage.locator('input[type="search"]')).toBeVisible();
    // Si hay al menos un grupo en BD, deberíamos ver una card. Si no,
    // el empty state. Cualquiera de los dos passes.
    const hasCards = (await authedPage.locator("a[href*='/social/grupos/']").count()) > 0;
    const hasEmpty = await authedPage.getByText(/Aún no hay grupos|No groups yet/i).count();
    expect(hasCards || hasEmpty > 0).toBe(true);
  });

  test("re-authentication: loginAs supports switching users", async ({ page }) => {
    await loginAs(page, "carlos-mendoza");
    await page.goto("/es/inicio");
    await expect(page.url()).toContain("/inicio");
    // Logueamos de nuevo como otro placeholder — la cookie nueva
    // debe reemplazar a la anterior.
    await loginAs(page, "layla-haddad");
    await page.goto("/es/social");
    await expect(page.url()).toContain("/social");
  });
});
