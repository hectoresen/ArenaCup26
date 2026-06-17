import { MaintenanceWall, getMaintenanceDecision } from "@/components/admin/maintenance-banner";
import { AppShell } from "@/components/app-shell/app-shell";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { getNotificationsForUser } from "@/server/notifications/queries";
import { eq } from "drizzle-orm";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { markAllReadAction } from "./_actions";

export const dynamic = "force-dynamic";

/**
 * Layout del route group `(app)`. Envuelve todas las rutas privadas:
 * `/inicio`, `/partidos`, `/ranking`, `/logros`, `/u/<username>`, etc.
 *
 * Aplica un guard server-side: si no hay sesión, redirige a la
 * landing pública. La landing renderiza el JoinCTA que dispara el
 * flow de login Google.
 */
export default async function AppGroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    // El redirect respeta el locale activo (es → `/es`, en → `/en`, ...).
    redirect(`/${locale}`);
  }

  // Maintenance guard: re-chequeamos AQUÍ además del root layout
  // porque Next.js memoiza el root layout entre navegaciones
  // client-side. Cuando el admin activa mantenimiento, un user ya
  // logueado que navegue entre páginas de `(app)` no volverá a
  // ejecutar el root layout — pero SÍ este, que es `force-dynamic`.
  // Sin este check, los users humanos con sesión activa pueden
  // seguir navegando y solo descubren el mantenimiento al intentar
  // mutar algo (predecir, etc) por el `assertNotInMaintenance` de
  // las server actions, lo cual es una UX horrible.
  const maintenance = await getMaintenanceDecision();
  if (maintenance.kind === "wall") {
    return <MaintenanceWall message={maintenance.message} />;
  }

  // Onboarding guard: si el user no ha completado el wizard
  // (`onboarded_at IS NULL`), redirige a `/bienvenido` antes de
  // renderizar el shell. La página `/bienvenido` vive FUERA de este
  // route group `(app)` para que este layout no se aplique sobre
  // ella — eso garantiza que no haya bucle de redirect.
  const onboardingRow = await db
    .select({
      onboardedAt: users.onboardedAt,
      lastActiveAt: users.lastActiveAt,
      avatarId: users.avatarId,
      name: users.name,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const isOnboarded = Boolean(onboardingRow[0]?.onboardedAt);
  const dbAvatarId = onboardingRow[0]?.avatarId ?? null;
  const dbName = onboardingRow[0]?.name ?? null;
  const dbImage = onboardingRow[0]?.image ?? null;
  if (!isOnboarded) {
    redirect(`/${locale}/bienvenido`);
  }

  // Throttled update de last_active_at: solo si han pasado al menos
  // 5 min desde el último ping. Sin throttle haríamos N UPDATEs por
  // request, lo cual es desperdicio puro. Con esta ventana, el peor
  // caso son ~12 UPDATEs/hora/user activo — trivial.
  const lastActive = onboardingRow[0]?.lastActiveAt ?? null;
  const PING_THROTTLE_MS = 5 * 60 * 1000;
  if (!lastActive || Date.now() - lastActive.getTime() > PING_THROTTLE_MS) {
    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, session.user.id));
  }

  const { items, unreadCount } = await getNotificationsForUser(db, session.user.id);

  // Fusionamos los datos del session JWT con los más frescos de BD —
  // `name`/`image` del session vienen del último login y no reflejan
  // cambios in-app (editor de nombre, avatar picker). Tras `router.refresh()`
  // el avatar nuevo aparece inmediatamente en la cabecera.
  const freshUser = {
    ...session.user,
    name: dbName ?? session.user.name,
    image: dbImage ?? session.user.image,
    avatarId: dbAvatarId,
  };

  return (
    <AppShell
      user={freshUser}
      notifications={items}
      unreadCount={unreadCount}
      onMarkAllRead={markAllReadAction}
    >
      {children}
    </AppShell>
  );
}
