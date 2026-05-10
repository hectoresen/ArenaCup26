import { db } from "@/server/db/client";
import { seedAchievements } from "@/server/achievements/seed";

async function main() {
  console.log("Seeding achievement_definitions…");
  const count = await seedAchievements(db);
  console.log(`✓ Upserted ${count} achievements.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[wmundial] seed:achievements failed:", error);
  process.exit(1);
});
