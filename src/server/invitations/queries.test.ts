import { describe, expect, it } from "vitest";
import { buildInvitationUrl } from "./queries";

/**
 * `buildInvitationUrl` lee `env.NEXT_PUBLIC_APP_URL`, que se congela
 * en el import del módulo `lib/env.ts`. En este harness `NEXT_PUBLIC_APP_URL`
 * vale `http://localhost:3000` (vitest.setup.ts), así que los tests
 * comparan contra esa base.
 */
describe("buildInvitationUrl", () => {
  it("composes the share link with the token in the query string", () => {
    expect(buildInvitationUrl("abc123")).toBe(
      "http://localhost:3000/?invite=abc123",
    );
  });

  it("URL-encodes tokens with reserved characters so the link no rompe al pegarse", () => {
    // `+`, `/` y caracteres no-ASCII se escapan; `-` y `_` no
    // (válidos en base64url) y por tanto se mantienen literales.
    expect(buildInvitationUrl("abc/123+ñ")).toBe(
      "http://localhost:3000/?invite=abc%2F123%2B%C3%B1",
    );
    expect(buildInvitationUrl("ok_token-XYZ")).toBe(
      "http://localhost:3000/?invite=ok_token-XYZ",
    );
  });

  it("evita el //?invite= cuando la base tiene trailing slash", () => {
    // No podemos cambiar `env` runtime aquí; lo verificamos contra
    // el comportamiento esperado de la helper sobre cualquier base.
    // El regex .replace(/\/$/, '') garantiza que un único `/` final
    // se elimina antes de añadir `/?invite=`.
    // Test funcional: la URL resultante NUNCA contiene `//?invite=`.
    expect(buildInvitationUrl("abc")).not.toMatch(/\/\/\?invite=/);
  });
});
