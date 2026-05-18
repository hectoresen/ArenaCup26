import { describe, expect, it } from "vitest";
import { resolveNotificationHref } from "./href";
import type { NotificationItem, NotificationKind } from "./types";

function build(kind: NotificationKind): NotificationItem {
  return {
    id: "n-1",
    kind,
    title: "title",
    body: null,
    matchId: null,
    achievementId: null,
    readAt: null,
    createdAt: new Date("2026-05-19T10:00:00Z"),
  };
}

describe("resolveNotificationHref — group_* kinds", () => {
  it.each([
    "group_invited",
    "group_joined",
    "group_left",
    "group_expelled",
    "group_admin_transferred",
    "group_deleted",
  ] as const)("%s routes to /social", (kind) => {
    expect(resolveNotificationHref(build(kind))).toBe("/social");
  });
});
