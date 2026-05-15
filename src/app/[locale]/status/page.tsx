import { TopChrome } from "@/components/layout/top-chrome";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

/**
 * Página de status pública. Versión "tonta": al cargar, server-side
 * pingea la BD y la config, decide un overall status y lo renderiza.
 * No hace polling client-side ni websocket: si el user quiere
 * refrescar, recarga la página. Ahorra overhead y mantiene el bundle
 * cliente intacto.
 */
export default async function StatusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();

  const services: Record<string, "ok" | "degraded" | "down"> = {};
  try {
    const started = Date.now();
    await db.execute(sql`select 1`);
    services.database = Date.now() - started < 500 ? "ok" : "degraded";
  } catch {
    services.database = "down";
  }
  services.auth = process.env.AUTH_SECRET ? "ok" : "down";
  services.match_data = process.env.API_FOOTBALL_KEY ? "ok" : "degraded";

  const overall: "ok" | "degraded" | "down" = Object.values(services).every((s) => s === "ok")
    ? "ok"
    : Object.values(services).some((s) => s === "down")
      ? "down"
      : "degraded";

  return <StatusContent user={session?.user ?? null} overall={overall} services={services} />;
}

function StatusContent({
  user,
  overall,
  services,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  overall: "ok" | "degraded" | "down";
  services: Record<string, "ok" | "degraded" | "down">;
}) {
  const t = useTranslations("status");
  return (
    <main
      id="main-content"
      className="relative z-10 flex min-h-screen items-start justify-center px-5 pb-16 pt-20 sm:pt-24"
    >
      <TopChrome user={user} />

      <article className="relative z-10 w-full max-w-[480px]">
        <header className="mb-8 text-center">
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">{t("title")}</h1>
          <OverallBadge status={overall} label={t(`overall.${overall}`)} />
        </header>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {Object.entries(services).map(([name, status]) => (
            <li
              key={name}
              className="flex items-center justify-between rounded-2xl border-2 border-border bg-card px-4 py-3"
            >
              <span className="font-display text-[14px] text-foreground">{t(`services.${name}`)}</span>
              <StatusChip status={status} label={t(`status.${status}`)} />
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-[11px] font-bold text-muted">
          {t("checkedAt", { time: new Date().toISOString() })}
        </p>

        <footer className="mt-6 flex justify-center">
          <Link
            href="/"
            className="cursor-pointer text-[12px] font-extrabold text-gold no-underline hover:underline"
          >
            ← {t("backHome")}
          </Link>
        </footer>
      </article>
    </main>
  );
}

function OverallBadge({
  status,
  label,
}: {
  status: "ok" | "degraded" | "down";
  label: string;
}) {
  const cls =
    status === "ok"
      ? "border-success/40 bg-success/10 text-success"
      : status === "degraded"
        ? "border-warm/40 bg-warm/10 text-warm"
        : "border-danger/40 bg-danger/10 text-danger";
  return (
    <div
      className={`mt-3 inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5 font-display text-[13px] uppercase tracking-[0.12em] ${cls}`}
    >
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-current" />
      {label}
    </div>
  );
}

function StatusChip({
  status,
  label,
}: {
  status: "ok" | "degraded" | "down";
  label: string;
}) {
  const cls =
    status === "ok"
      ? "text-success"
      : status === "degraded"
        ? "text-warm"
        : "text-danger";
  return (
    <span className={`text-[11px] font-extrabold uppercase tracking-[0.1em] ${cls}`}>{label}</span>
  );
}
