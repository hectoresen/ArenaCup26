import { eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { userAchievements, userPoints, users } from "@/server/db/schema";

/**
 * 3 usuarios "placeholder" que decoran el leaderboard cuando todavía
 * no hay tráfico real. Antes vivían como datos hardcodeados en
 * `src/lib/leaderboard/real.ts`. Ahora son filas reales en BD: así,
 * un usuario que pulse sobre Carlos / Layla / Tomás desde el ranking
 * navega a `/u/<username>` y ve un perfil completo (stats + logros).
 *
 * Cuando suficientes usuarios reales superen sus puntos, los seeds
 * caen al fondo del ranking de forma natural. Una vez la app tenga
 * ~20 usuarios reales activos, se pueden retirar editando este array.
 *
 * IDs estables (`seed-*`) para que la función sea idempotente.
 */
/**
 * Puntos calculados para que un user real pueda **superarlos rápido**
 * acertando predicciones (1 simple = 10 pts, 1 exact = 30 pts). Top 1
 * son ~85 pts: alcanzable con ~3 exactos o un combo de 3 hits.
 *
 * Distribución elegida (de top a bottom):
 *   85 → 70 → 55 → 40 → 30 → 20 → 10
 *
 * El user puede ir viendo cómo escala posición a posición a medida
 * que va acertando, en lugar de quedarse en #8 indefinidamente.
 */
const SEED_USERS = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    email: "seed-maya@webmundial.local",
    username: "maya-petrova",
    name: "Maya Petrova",
    country: "BG",
    image: null as string | null,
    totalPoints: 85,
    // Algunos placeholders tienen rachas ≥ 3 para que el ranking
    // se vea vivo (chip 🔥 ×N en `rank-row.tsx`); otros no, para
    // que conviva con "sin racha" y resulte realista.
    streak: 5,
    correctCount: 4,
    /** Si `true`, el seed apareceá con el puntito verde de online
     *  (ventana 24h en `real.ts`). Repartido para variedad. */
    online: true,
    /** IDs de logros del catálogo a desbloquear (ver `achievements/catalog.ts`). */
    unlockedAchievements: ["first-hit", "exact-shot"],
  },
  {
    id: "00000000-0000-4000-a000-000000000002",
    email: "seed-kenji@webmundial.local",
    username: "kenji-yamamoto",
    name: "Kenji Yamamoto",
    country: "JP",
    image: null as string | null,
    totalPoints: 70,
    streak: 4,
    correctCount: 4,
    online: true,
    unlockedAchievements: ["first-hit", "exact-shot"],
  },
  {
    id: "00000000-0000-4000-a000-000000000003",
    email: "seed-sofia@webmundial.local",
    username: "sofia-rojas",
    name: "Sofía Rojas",
    country: "PE",
    image: null as string | null,
    totalPoints: 55,
    streak: 3,
    correctCount: 3,
    online: false,
    unlockedAchievements: ["first-hit", "exact-shot"],
  },
  {
    id: "00000000-0000-4000-a000-000000000004",
    email: "seed-ahmed@webmundial.local",
    username: "ahmed-salah",
    name: "Ahmed Salah",
    country: "EG",
    image: null as string | null,
    totalPoints: 40,
    streak: 0,
    correctCount: 2,
    online: true,
    unlockedAchievements: ["first-hit"],
  },
  {
    id: "00000000-0000-4000-a000-000000000005",
    email: "seed-linnea@webmundial.local",
    username: "linnea-borg",
    name: "Linnea Borg",
    country: "SE",
    image: null as string | null,
    totalPoints: 30,
    streak: 6,
    correctCount: 2,
    online: false,
    unlockedAchievements: ["first-hit"],
  },
  {
    id: "00000000-0000-4000-a000-000000000006",
    email: "seed-diego@webmundial.local",
    username: "diego-vargas",
    name: "Diego Vargas",
    country: "CL",
    image: null as string | null,
    totalPoints: 20,
    streak: 0,
    correctCount: 1,
    online: true,
    unlockedAchievements: ["first-hit"],
  },
  {
    id: "00000000-0000-4000-a000-000000000007",
    email: "seed-aicha@webmundial.local",
    username: "aicha-diallo",
    name: "Aïcha Diallo",
    country: "CI",
    image: null as string | null,
    totalPoints: 10,
    streak: 3,
    correctCount: 1,
    online: false,
    unlockedAchievements: ["first-hit"],
  },
] as const;

/**
 * Inserta o actualiza los 3 usuarios placeholder + sus puntos +
 * algunos logros desbloqueados. Idempotente: re-ejecutar nunca
 * duplica filas, solo refresca puntos si se editan los seeds.
 *
 * Llamado desde `scripts/bootstrap.ts` en cada deploy.
 *
 * Solo intenta desbloquear logros cuyo id exista en
 * `achievement_definitions` (catálogo ya seedado por
 * `seedAchievements`); en otro caso ignora el id para no romper el
 * bootstrap si renombramos un achievement.
 */
export async function seedLeaderboardPlaceholders(db: Database): Promise<number> {
  let count = 0;
  // `lastActiveAt` derivado del flag `online` del seed: si online,
  // set a now() → muestra puntito verde en ranking y perfil. Si no,
  // queda `null` → sin actividad reciente. Se refresca en cada
  // ejecución del seed (deploys) para mantener "vivos" a los users
  // que deberían estarlo.
  const now = new Date();
  for (const seed of SEED_USERS) {
    // 1) Upsert del user. `email` es NOT NULL en el schema (Auth.js
    //    DrizzleAdapter); usamos un dominio reservado para que no
    //    colisione con emails reales y se detecte como sintético.
    const lastActiveAt = seed.online ? now : null;
    await db
      .insert(users)
      .values({
        id: seed.id,
        email: seed.email,
        name: seed.name,
        username: seed.username,
        country: seed.country,
        image: seed.image,
        lastActiveAt,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: seed.email,
          name: seed.name,
          username: seed.username,
          country: seed.country,
          image: seed.image,
          lastActiveAt,
        },
      });

    // 2) Upsert de sus puntos. `streakMax` y `simpleHits` no los
    //    declaramos en el seed (no tenemos datos históricos de los
    //    placeholders); los inicializamos derivados: streakMax =
    //    streak actual, simpleHits = correctCount (asumimos todos
    //    sus aciertos fueron simple/exact, no doubles).
    await db
      .insert(userPoints)
      .values({
        userId: seed.id,
        totalPoints: seed.totalPoints,
        streak: seed.streak,
        streakMax: seed.streak,
        correctCount: seed.correctCount,
        simpleHits: seed.correctCount,
      })
      .onConflictDoUpdate({
        target: userPoints.userId,
        set: {
          totalPoints: seed.totalPoints,
          streak: seed.streak,
          streakMax: seed.streak,
          correctCount: seed.correctCount,
          simpleHits: seed.correctCount,
        },
      });

    // 3) Desbloquear logros (best-effort: si el id no existe en el
    //    catálogo, el FK falla y lo capturamos sin abortar).
    for (const achievementId of seed.unlockedAchievements) {
      try {
        await db
          .insert(userAchievements)
          .values({ userId: seed.id, achievementId })
          .onConflictDoNothing();
      } catch {
        // achievement id desconocido → ignorar.
      }
    }
    count++;
  }
  return count;
}

/**
 * Borra los 3 seed users + sus dependencias (cascade lo limpia).
 * Para retirar los placeholders cuando ya no aporten valor.
 */
export async function removeLeaderboardPlaceholders(db: Database): Promise<number> {
  let removed = 0;
  for (const seed of SEED_USERS) {
    const result = await db.delete(users).where(eq(users.id, seed.id));
    // drizzle no devuelve rowCount uniforme; contamos por entrada.
    if (result) removed++;
  }
  return removed;
}
