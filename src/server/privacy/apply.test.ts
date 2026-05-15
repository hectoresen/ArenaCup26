import { describe, expect, it } from "vitest";
import { canViewProfile, normalizePrivacy } from "./apply";

describe("normalizePrivacy", () => {
  it("returns public default for null/undefined raw", () => {
    expect(normalizePrivacy(null)).toEqual({ visibility: "public" });
    expect(normalizePrivacy(undefined)).toEqual({ visibility: "public" });
  });

  it("preserves valid visibility values", () => {
    expect(normalizePrivacy({ visibility: "private" })).toEqual({ visibility: "private" });
    expect(normalizePrivacy({ visibility: "friends_only" })).toEqual({
      visibility: "friends_only",
    });
    expect(normalizePrivacy({ visibility: "public" })).toEqual({ visibility: "public" });
  });

  it("falls back to public for unknown visibility values", () => {
    expect(normalizePrivacy({ visibility: "weird" })).toEqual({ visibility: "public" });
  });

  it("ignores legacy showName/showCountry/... fields (removed 2026-05-15)", () => {
    // Pasamos un objeto con campos antiguos via cast — normalizePrivacy
    // recibe `unknown` así que el shape extra no rompe TS.
    expect(
      normalizePrivacy({
        visibility: "private",
        showName: false,
        showCountry: false,
        showImage: false,
      } as unknown),
    ).toEqual({ visibility: "private" });
  });
});

describe("canViewProfile", () => {
  const owner = "owner-uuid";
  const viewer = "viewer-uuid";

  it("public: anyone (including anonymous) can view", () => {
    expect(canViewProfile({ visibility: "public" }, owner, null)).toBe(true);
    expect(canViewProfile({ visibility: "public" }, owner, viewer)).toBe(true);
    expect(canViewProfile({ visibility: "public" }, owner, owner)).toBe(true);
  });

  it("private: only the owner can view", () => {
    expect(canViewProfile({ visibility: "private" }, owner, null)).toBe(false);
    expect(canViewProfile({ visibility: "private" }, owner, viewer)).toBe(false);
    expect(canViewProfile({ visibility: "private" }, owner, owner)).toBe(true);
  });

  it("friends_only: owner or accepted friend can view", () => {
    expect(canViewProfile({ visibility: "friends_only" }, owner, null)).toBe(false);
    expect(canViewProfile({ visibility: "friends_only" }, owner, viewer, false)).toBe(false);
    expect(canViewProfile({ visibility: "friends_only" }, owner, viewer, true)).toBe(true);
    expect(canViewProfile({ visibility: "friends_only" }, owner, owner)).toBe(true);
  });
});
