import { describe, expect, it } from "vitest";
import { resolveNotificationHref } from "./href";
import type { NotificationItem } from "./types";

function build(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: "n-1",
    kind: "system",
    title: "title",
    body: null,
    matchId: null,
    achievementId: null,
    readAt: null,
    createdAt: new Date("2026-05-16T10:00:00Z"),
    ...overrides,
  };
}

describe("resolveNotificationHref", () => {
  it("friend_request and friend_accepted route to /social (no matchId needed)", () => {
    expect(resolveNotificationHref(build({ kind: "friend_request" }))).toBe("/social");
    expect(resolveNotificationHref(build({ kind: "friend_accepted" }))).toBe("/social");
  });

  it("achievement_unlocked routes to /logros even without achievementId", () => {
    expect(resolveNotificationHref(build({ kind: "achievement_unlocked" }))).toBe("/logros");
  });

  it("match-related kinds route to /partidos/<matchId> when matchId is present", () => {
    expect(
      resolveNotificationHref(build({ kind: "prediction_sent", matchId: "m1" })),
    ).toBe("/partidos/m1");
    expect(
      resolveNotificationHref(build({ kind: "prediction_locked", matchId: "m2" })),
    ).toBe("/partidos/m2");
    expect(
      resolveNotificationHref(build({ kind: "match_finished", matchId: "m3" })),
    ).toBe("/partidos/m3");
  });

  it("match-related kinds return null when matchId is missing (no deep-link target)", () => {
    expect(resolveNotificationHref(build({ kind: "prediction_sent", matchId: null }))).toBeNull();
    expect(resolveNotificationHref(build({ kind: "prediction_locked", matchId: null }))).toBeNull();
    expect(resolveNotificationHref(build({ kind: "match_finished", matchId: null }))).toBeNull();
  });

  it("system kind never routes anywhere (row stays as a plain <div>)", () => {
    expect(resolveNotificationHref(build({ kind: "system" }))).toBeNull();
    // Aunque venga con matchId casualmente, system NO navega.
    expect(resolveNotificationHref(build({ kind: "system", matchId: "m9" }))).toBeNull();
  });
});
