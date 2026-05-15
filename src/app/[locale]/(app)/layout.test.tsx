import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`__REDIRECT__:${url}`);
});

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/components/app-shell/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));
// Mock que simula el chain drizzle: select().from().where().limit() →
// devuelve un row con `onboardedAt` para que el guard del layout pase
// al render. Cada test puede sobreescribir con `onboardingRowMock`.
const onboardingRowMock = vi.fn(async () => [
  { onboardedAt: new Date(), lastActiveAt: new Date() },
]);
vi.mock("@/server/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => onboardingRowMock(),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  },
}));
vi.mock("@/server/notifications/queries", () => ({
  getNotificationsForUser: async () => ({ items: [], unreadCount: 0 }),
}));
vi.mock("./_actions", () => ({ markAllReadAction: async () => {} }));

const { default: AppGroupLayout } = await import("./layout");

describe("(app) layout — auth guard", () => {
  beforeEach(() => {
    authMock.mockReset();
    redirectMock.mockClear();
  });

  it("redirects to /<locale> when there is no session", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(
      AppGroupLayout({
        children: <div>child</div>,
        params: Promise.resolve({ locale: "es" }),
      }),
    ).rejects.toThrow("__REDIRECT__:/es");
    expect(redirectMock).toHaveBeenCalledWith("/es");
  });

  it("redirects with the active locale prefix (fr)", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(
      AppGroupLayout({
        children: <div>child</div>,
        params: Promise.resolve({ locale: "fr" }),
      }),
    ).rejects.toThrow("__REDIRECT__:/fr");
  });

  it("redirects when the session has no user", async () => {
    authMock.mockResolvedValueOnce({ user: null });
    await expect(
      AppGroupLayout({
        children: <div>child</div>,
        params: Promise.resolve({ locale: "es" }),
      }),
    ).rejects.toThrow("__REDIRECT__:/es");
  });

  it("renders the AppShell when there IS a session", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "user-1", name: "Carlos Mendoza", email: "c@example.com", image: null },
    });
    const el = await AppGroupLayout({
      children: <div data-testid="child">page-content</div>,
      params: Promise.resolve({ locale: "es" }),
    });
    expect(redirectMock).not.toHaveBeenCalled();
    // El layout devuelve un elemento `<AppShell>` con children adentro.
    // Como AppShell está mockeado, basta con verificar el shape del retorno.
    expect(el).toBeDefined();
    const reactEl = el as { type: { name: string }; props: { user: { name: string } } };
    expect(reactEl.type.name).toBe("AppShell");
    expect(reactEl.props.user.name).toBe("Carlos Mendoza");
  });
});
