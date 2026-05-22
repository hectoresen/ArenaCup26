import type { UserPrivacy } from "@/server/db/schema";
import { describe, expect, it } from "vitest";
import { canViewProfile, normalizePrivacy } from "./apply";

const defaults = { visibility: "public" as const, showHistory: true };

function p(overrides: Partial<UserPrivacy>): UserPrivacy {
  return { ...defaults, ...overrides };
}

describe("normalizePrivacy", () => {
  it("returns full defaults for null/undefined raw", () => {
    expect(normalizePrivacy(null)).toEqual(defaults);
    expect(normalizePrivacy(undefined)).toEqual(defaults);
  });

  it("preserves valid visibility values", () => {
    expect(normalizePrivacy({ visibility: "private" })).toEqual({
      visibility: "private",
      showHistory: true,
    });
    expect(normalizePrivacy({ visibility: "friends_only" })).toEqual({
      visibility: "friends_only",
      showHistory: true,
    });
    expect(normalizePrivacy({ visibility: "public" })).toEqual(defaults);
  });

  it("falls back to public for unknown visibility values", () => {
    expect(normalizePrivacy({ visibility: "weird" })).toEqual(defaults);
  });

  it("respects showHistory=false explicit", () => {
    expect(normalizePrivacy({ visibility: "public", showHistory: false })).toEqual({
      visibility: "public",
      showHistory: false,
    });
  });

  it("defaults showHistory to true for rows pre-2026-05-18 (missing field)", () => {
    expect(normalizePrivacy({ visibility: "public" })).toEqual({
      visibility: "public",
      showHistory: true,
    });
  });

  it("ignores legacy showName/showCountry/... fields (removed 2026-05-15)", () => {
    expect(
      normalizePrivacy({
        visibility: "private",
        showName: false,
        showCountry: false,
        showImage: false,
      } as unknown),
    ).toEqual({ visibility: "private", showHistory: true });
  });
});

describe("canViewProfile", () => {
  const owner = "owner-uuid";
  const viewer = "viewer-uuid";

  it("public: anyone (including anonymous) can view", () => {
    expect(canViewProfile(p({ visibility: "public" }), owner, null)).toBe(true);
    expect(canViewProfile(p({ visibility: "public" }), owner, viewer)).toBe(true);
    expect(canViewProfile(p({ visibility: "public" }), owner, owner)).toBe(true);
  });

  it("private: only the owner can view", () => {
    expect(canViewProfile(p({ visibility: "private" }), owner, null)).toBe(false);
    expect(canViewProfile(p({ visibility: "private" }), owner, viewer)).toBe(false);
    expect(canViewProfile(p({ visibility: "private" }), owner, owner)).toBe(true);
  });

  it("friends_only: owner or accepted friend can view", () => {
    expect(canViewProfile(p({ visibility: "friends_only" }), owner, null)).toBe(false);
    expect(canViewProfile(p({ visibility: "friends_only" }), owner, viewer, false)).toBe(false);
    expect(canViewProfile(p({ visibility: "friends_only" }), owner, viewer, true)).toBe(true);
    expect(canViewProfile(p({ visibility: "friends_only" }), owner, owner)).toBe(true);
  });
});
