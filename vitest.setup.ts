import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * `next/navigation`: en jsdom no hay AppRouterProvider, así que
 * `useRouter()`/`usePathname()` lanzan al ser invocados. Los
 * componentes cliente como `<EditableName>` y `<AvatarPicker>` los
 * llaman para hacer `router.refresh()` tras una acción. Stub global
 * con no-op evita reemplazar el mock en cada test file.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

/**
 * Mock global de los módulos server-action que importan `next-auth`
 * o `next/server` (no funcionan bien en jsdom). Componentes cliente
 * como `<EditableName>` o `<AvatarPicker>` los importan, así que
 * cualquier test que los renderice fallaría sin esto.
 *
 * Cada test individual puede sobrescribir con su propio `vi.mock`
 * si quiere validar el comportamiento de la action.
 */
vi.mock("@/server/profile/actions", () => ({
  updateProfileName: vi.fn(async () => ({ ok: true })),
  updateProfileAvatar: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/onboarding/actions", () => ({
  completeOnboarding: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/privacy/actions", () => ({
  updatePrivacy: vi.fn(async () => ({ ok: true })),
  privacyOrDefault: (raw: unknown) => raw,
}));
vi.mock("@/server/friends/actions", () => ({
  sendFriendRequest: vi.fn(async () => ({ ok: true })),
  acceptFriendRequest: vi.fn(async () => ({ ok: true })),
  rejectFriendRequest: vi.fn(async () => ({ ok: true })),
  removeFriend: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/invitations/actions", () => ({
  createInvitation: vi.fn(async () => ({ ok: true, token: "tok", url: "http://x/?invite=tok" })),
  revokeInvitation: vi.fn(async () => ({ ok: true })),
  dismissInviteCookie: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/users/delete-account", () => ({
  deleteAccount: vi.fn(async () => ({ ok: true })),
}));

/**
 * Env vars mínimas para que cualquier test que importe (directa o
 * indirectamente) `@/lib/env` no rompa por la validación zod. No
 * son secretos reales — son placeholders válidos según el schema:
 *
 *  - AUTH_SECRET ≥ 32 chars
 *  - DATABASE_URL como URL válida
 *  - GOOGLE_CLIENT_ID / SECRET no vacíos
 *
 * El módulo `env.ts` se carga una sola vez al primer import; estos
 * defaults solo se aplican si las variables no estaban ya set.
 */
process.env.AUTH_SECRET ??= "test-auth-secret-must-be-at-least-32-chars-long";
process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
