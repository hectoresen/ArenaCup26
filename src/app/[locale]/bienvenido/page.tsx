import { eq } from "drizzle-orm";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { auth } from "@/lib/auth";
import { slugifyName } from "@/server/users/username";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";

/**
 * Wizard de bienvenida tras el primer login. SSR carga los valores
 * actuales (Auth.js + DrizzleAdapter ya rellenó `name` desde Google
 * y un username auto-generado; aquí el user los confirma/edita y
 * elige país).
 *
 * Si el user ya está onboarded, redirige directo a `/inicio` para
 * no mostrar el wizard dos veces. El layout `(app)` también
 * impide la situación inversa (onboarded falso visita `/inicio`).
 */
export default async function BienvenidoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const row = await db
    .select({
      name: users.name,
      username: users.username,
      country: users.country,
      onboardedAt: users.onboardedAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (row[0]?.onboardedAt) {
    redirect(`/${locale}/inicio`);
  }

  const fallbackUsername = row[0]?.username ?? slugifyName(row[0]?.name);

  return (
    <OnboardingWizard
      initial={{
        username: fallbackUsername,
        country: row[0]?.country ?? null,
      }}
    />
  );
}
