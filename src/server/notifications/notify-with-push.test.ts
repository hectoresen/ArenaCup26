import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `notifyWithPush` orquesta dos efectos: persistir la fila in-app
 * y disparar pushes a las subscriptions del user. Estos tests cubren
 * las reglas de orquestación, mockeando ambos lados:
 *
 *  - `createNotification` siempre se llama (contrato base).
 *  - `getUserPushSubscriptions` decide cuántos pushes se intentan.
 *  - `sendPushTo` devuelve resultados variados (success, gone,
 *    not_configured, transient) que el helper debe interpretar.
 *  - `deletePushSubscriptionByEndpoint` se llama solo para los
 *    endpoints `gone`.
 */

const mockCreate = vi.hoisted(() => vi.fn(async () => ({ id: "notif-1" })));
const mockGetSubs = vi.hoisted(() =>
  vi.fn(async (_db: unknown, _userId: string) => [] as Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>),
);
const mockSend = vi.hoisted(() =>
  vi.fn(
    async (_sub: unknown, _payload: unknown) =>
      null as null | { kind: "gone"; endpoint: string } | { kind: "not_configured" } | { kind: "transient"; message: string },
  ),
);
const mockDelete = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("./create", () => ({
  createNotification: mockCreate,
}));
vi.mock("@/server/push/queries", () => ({
  getUserPushSubscriptions: mockGetSubs,
  deletePushSubscriptionByEndpoint: mockDelete,
}));
vi.mock("@/server/push/client", () => ({
  sendPushTo: mockSend,
}));

const { notifyWithPush } = await import("./notify-with-push");

function sub(id: string, endpoint: string) {
  return { id, endpoint, p256dh: "p", auth: "a" };
}

describe("notifyWithPush", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockGetSubs.mockClear();
    mockSend.mockClear();
    mockDelete.mockClear();
    mockCreate.mockResolvedValue({ id: "notif-1" });
    mockGetSubs.mockResolvedValue([]);
    mockSend.mockResolvedValue(null);
  });

  it("always inserts the in-app row (contrato base)", async () => {
    await notifyWithPush({
      db: {} as never,
      userId: "u1",
      kind: "friend_request",
      title: "hola",
      pushable: false,
    });
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockGetSubs).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not push when pushable is false (even with subscriptions)", async () => {
    mockGetSubs.mockResolvedValue([sub("s1", "https://fcm/1")]);
    await notifyWithPush({
      db: {} as never,
      userId: "u1",
      kind: "friend_request",
      title: "hola",
      pushable: false,
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not push when user has no subscriptions", async () => {
    mockGetSubs.mockResolvedValue([]);
    await notifyWithPush({
      db: {} as never,
      userId: "u1",
      kind: "friend_request",
      title: "hola",
      pushable: true,
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends to all subscriptions in parallel when pushable + has subs", async () => {
    mockGetSubs.mockResolvedValue([
      sub("s1", "https://fcm/1"),
      sub("s2", "https://mozilla/2"),
      sub("s3", "https://apple/3"),
    ]);
    await notifyWithPush({
      db: {} as never,
      userId: "u1",
      kind: "friend_request",
      title: "hola",
      pushable: true,
    });
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it("uses the same URL that the bell row uses (resolveNotificationHref)", async () => {
    mockGetSubs.mockResolvedValue([sub("s1", "https://fcm/1")]);
    await notifyWithPush({
      db: {} as never,
      userId: "u1",
      kind: "friend_request",
      title: "hola",
      pushable: true,
    });
    const [, payload] = mockSend.mock.calls[0] ?? [];
    expect((payload as { url: string }).url).toBe("/social");
  });

  it("skips push entirely when the kind has no destination (system)", async () => {
    mockGetSubs.mockResolvedValue([sub("s1", "https://fcm/1")]);
    await notifyWithPush({
      db: {} as never,
      userId: "u1",
      kind: "system",
      title: "x",
      pushable: true,
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("cleans up subscriptions that return 'gone'", async () => {
    mockGetSubs.mockResolvedValue([
      sub("s1", "https://fcm/1"),
      sub("s2", "https://mozilla/2"),
    ]);
    mockSend.mockImplementation(async (rawSub) => {
      const s = rawSub as { endpoint: string };
      if (s.endpoint === "https://fcm/1") {
        return { kind: "gone", endpoint: s.endpoint };
      }
      return null;
    });
    await notifyWithPush({
      db: {} as never,
      userId: "u1",
      kind: "friend_request",
      title: "hola",
      pushable: true,
    });
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(expect.anything(), "https://fcm/1");
  });

  it("does not delete subscriptions on transient errors", async () => {
    mockGetSubs.mockResolvedValue([sub("s1", "https://fcm/1")]);
    mockSend.mockResolvedValue({ kind: "transient", message: "timeout" });
    await notifyWithPush({
      db: {} as never,
      userId: "u1",
      kind: "friend_request",
      title: "hola",
      pushable: true,
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns the same id as createNotification (contract preserved)", async () => {
    mockCreate.mockResolvedValue({ id: "notif-abc" });
    const result = await notifyWithPush({
      db: {} as never,
      userId: "u1",
      kind: "friend_request",
      title: "hola",
      pushable: true,
    });
    expect(result.id).toBe("notif-abc");
  });

  it("swallows errors loading subscriptions (in-app row still saved)", async () => {
    mockGetSubs.mockRejectedValue(new Error("db down"));
    const result = await notifyWithPush({
      db: {} as never,
      userId: "u1",
      kind: "friend_request",
      title: "hola",
      pushable: true,
    });
    expect(result.id).toBe("notif-1");
    expect(mockCreate).toHaveBeenCalled();
  });
});
