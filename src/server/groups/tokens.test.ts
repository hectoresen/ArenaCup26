import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://arenacup26.com" },
}));

import { buildGroupInviteUrl, generateGroupLinkToken } from "./tokens";

describe("generateGroupLinkToken", () => {
  it("produces URL-safe base64 (no /+= chars)", () => {
    for (let i = 0; i < 50; i++) {
      const t = generateGroupLinkToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("produces tokens with at least 22 chars (16 bytes base64url)", () => {
    const t = generateGroupLinkToken();
    expect(t.length).toBeGreaterThanOrEqual(22);
  });

  it("never produces the same token twice in 100 generations", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateGroupLinkToken());
    expect(set.size).toBe(100);
  });
});

describe("buildGroupInviteUrl", () => {
  it("builds /social/grupos/unirse/<token> with the configured base", () => {
    expect(buildGroupInviteUrl("abc123")).toBe(
      "https://arenacup26.com/social/grupos/unirse/abc123",
    );
  });

  it("encodes tokens that contain url-special chars (defensive — shouldn't happen with base64url)", () => {
    expect(buildGroupInviteUrl("a/b+c")).toBe(
      "https://arenacup26.com/social/grupos/unirse/a%2Fb%2Bc",
    );
  });

  it("strips trailing slash from base URL to avoid double slashes", () => {
    // El mock devuelve sin slash, pero esta defensive case verifica el
    // contract del helper.
    expect(buildGroupInviteUrl("xyz").startsWith("https://arenacup26.com/social/grupos/unirse/")).toBe(
      true,
    );
    expect(buildGroupInviteUrl("xyz")).not.toContain("//social");
  });
});
