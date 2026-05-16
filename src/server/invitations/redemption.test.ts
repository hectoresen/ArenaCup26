import { describe, expect, it } from "vitest";
import { generateInvitationToken } from "./redemption";

describe("generateInvitationToken", () => {
  it("returns a URL-safe base64 string", () => {
    const token = generateInvitationToken();
    // base64url no usa `+`, `/` ni `=`. Solo letras (A-Za-z),
    // dígitos (0-9), `-` y `_`.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("has the expected length for 16 bytes of entropy (≈22 chars)", () => {
    const token = generateInvitationToken();
    // 16 bytes en base64 sin padding = 22 chars exactos. Si el
    // generator cambia (e.g. 24 bytes), este test obliga a revisitar
    // la columna `text` del schema y el lado del cliente.
    expect(token).toHaveLength(22);
  });

  it("produces unique tokens (no collisions on 1000 generations)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateInvitationToken());
    expect(seen.size).toBe(1000);
  });

  it("never returns a token containing characters that need URL encoding", () => {
    for (let i = 0; i < 100; i++) {
      const token = generateInvitationToken();
      expect(encodeURIComponent(token)).toBe(token);
    }
  });
});
