import { type Page, test as base, expect } from "@playwright/test";

/**
 * Helpers de auth E2E. Usan el endpoint `/api/test/auth-as` (solo
 * habilitado fuera de prod con `E2E_AUTH_ENABLED=true` +
 * `E2E_AUTH_SECRET`) para crear sesiones sin pasar por Google OAuth.
 *
 * Test data usado: los usuarios placeholder seedeados por
 * `seedLeaderboardPlaceholders` (Carlos, Layla, Tomás, etc). Sus
 * usernames son estables y sus IDs son determinísticos via UUID
 * generado por el seed.
 *
 * Para activar local:
 *   E2E_AUTH_ENABLED=true E2E_AUTH_SECRET=$(openssl rand -hex 24) \
 *     pnpm dev
 *   E2E_AUTH_SECRET=<mismo> pnpm exec playwright test
 */

type AuthedFixtures = {
  authedPage: Page;
};

/**
 * Username placeholder con sesión inicializada. Override en tests
 * individuales si necesitas otro user.
 */
export const DEFAULT_TEST_USERNAME = "carlos-mendoza";

/**
 * Cookie + API call para autenticarse como `username`. Usar en
 * `beforeEach` o como fixture de Playwright. Lanza error si el
 * endpoint no está habilitado (env vars no seteadas).
 */
export async function loginAs(page: Page, username: string = DEFAULT_TEST_USERNAME): Promise<void> {
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "loginAs: missing E2E_AUTH_SECRET. Setup the env var to run " +
        "authenticated E2E tests. See e2e/fixtures.ts for details.",
    );
  }
  const res = await page.request.post("/api/test/auth-as", {
    headers: { "x-e2e-secret": secret },
    data: { username },
  });
  if (!res.ok()) {
    throw new Error(`loginAs failed: ${res.status()} ${await res.text().catch(() => "")}`);
  }
}

/**
 * Fixture de Playwright que extiende el `page` con sesión activa.
 * Uso:
 *   test("foo", async ({ authedPage }) => { await authedPage.goto("/inicio") });
 */
export const test = base.extend<AuthedFixtures>({
  authedPage: async ({ page }, use) => {
    await loginAs(page);
    await use(page);
  },
});

export { expect };
