import { getUserAchievements } from "@/server/admin/user-achievements";
import { getUserDetailForAdmin } from "@/server/admin/users-list";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AchievementsTable } from "./_components/achievements-table";

export const dynamic = "force-dynamic";

export default async function AdminUserAchievementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, achievements] = await Promise.all([
    getUserDetailForAdmin(id),
    getUserAchievements(id),
  ]);
  if (!user) notFound();

  const unlockedCount = achievements.filter((a) => a.unlockedAt !== null).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-100">Logros</h1>
          <p className="mt-1 text-sm text-slate-400">
            {user.name ?? user.email} · <span className="font-bold text-gold">{unlockedCount}</span>
            /{achievements.length} desbloqueados
          </p>
        </div>
        <Link
          href={`/admin/users/${id}`}
          className="shrink-0 cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:border-gold/40 hover:text-gold"
        >
          ← Volver al detalle
        </Link>
      </div>

      <AchievementsTable userId={id} achievements={achievements} />
    </div>
  );
}
