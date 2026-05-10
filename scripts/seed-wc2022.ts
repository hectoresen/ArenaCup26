import { db } from "@/server/db/client";
import { seedWC2022 } from "@/server/seeds/wc2022/seed";

async function main() {
  console.log("Seeding WC 2022 (Qatar) into BD…");
  console.log("⚠️  Esto borra predictions y matches existentes.");
  const { teams, matches } = await seedWC2022(db);
  console.log(`✓ Inserted ${teams} teams and ${matches} matches.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[wmundial] seed:wc2022 failed:", error);
  process.exit(1);
});
