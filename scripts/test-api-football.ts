/**
 * Smoke-test contra api-football: verifica la conexión, autenticación y
 * los datos crudos que devuelve para hoy. Útil cuando hay sospecha de
 * fallo en el pipeline (cron parado, transiciones live perdidas).
 *
 * Uso:
 *   API_FOOTBALL_KEY=xxx npx tsx scripts/test-api-football.ts
 *
 * Imprime, para hoy:
 *   1. /status → cuota restante.
 *   2. /fixtures?date=YYYY-MM-DD filtrado a las ligas configuradas →
 *      conteo por status (LIVE/FT/NS/etc) y muestreo de 5 fixtures.
 *
 * NO toca la BD ni dispara scoring — solo lee de api-football.
 */
import { env } from "@/lib/env";

async function main() {
  const apiKey = env.API_FOOTBALL_KEY;
  if (!apiKey) {
    console.error("❌ API_FOOTBALL_KEY no está definida en el env.");
    process.exit(1);
  }

  const baseUrl = env.API_FOOTBALL_BASE_URL;
  const headers = { "x-apisports-key": apiKey };

  console.log("\n=== 1. /status (cuota) ===");
  const statusRes = await fetch(`${baseUrl}/status`, { headers });
  if (!statusRes.ok) {
    console.error(`  ❌ ${statusRes.status} ${statusRes.statusText}`);
    process.exit(1);
  }
  const statusJson = (await statusRes.json()) as {
    response: {
      account: { firstname: string; email: string };
      subscription: { plan: string; end: string };
      requests: { current: number; limit_day: number };
    };
  };
  const r = statusJson.response;
  console.log(`  Cuenta: ${r.account.firstname} (${r.account.email})`);
  console.log(`  Plan:   ${r.subscription.plan} (hasta ${r.subscription.end})`);
  console.log(`  Quota:  ${r.requests.current} / ${r.requests.limit_day} hoy`);

  console.log("\n=== 2. Fixtures de hoy ===");
  const today = new Date().toISOString().slice(0, 10);
  const filter = env.MATCH_DATA_LEAGUE_FILTER;
  const url = `${baseUrl}/fixtures?date=${today}`;
  console.log(`  Pidiendo: ${url}`);
  console.log(`  Filtro ligas configurado: [${filter.join(", ")}]`);

  const fxRes = await fetch(url, { headers });
  if (!fxRes.ok) {
    console.error(`  ❌ ${fxRes.status} ${fxRes.statusText}`);
    process.exit(1);
  }
  const fxJson = (await fxRes.json()) as {
    response: Array<{
      fixture: {
        id: number;
        date: string;
        status: { short: string; long: string; elapsed: number | null };
      };
      league: { id: number; name: string };
      teams: { home: { name: string }; away: { name: string } };
      goals: { home: number | null; away: number | null };
    }>;
  };
  const all = fxJson.response;
  const inFilter = filter.length > 0 ? all.filter((f) => filter.includes(f.league.id)) : all;

  console.log(`  Total fixtures hoy:        ${all.length}`);
  console.log(`  En nuestras ligas:         ${inFilter.length}`);

  const statuses = new Map<string, number>();
  for (const f of inFilter) {
    statuses.set(f.fixture.status.short, (statuses.get(f.fixture.status.short) ?? 0) + 1);
  }
  console.log(`\n  Por status (short):`);
  for (const [s, n] of [...statuses.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s.padEnd(6)} ${n}`);
  }

  console.log(`\n  Muestra (primeros 8 de nuestras ligas):`);
  for (const f of inFilter.slice(0, 8)) {
    const hh = f.fixture.date.slice(11, 16);
    const score =
      f.goals.home !== null && f.goals.away !== null ? `${f.goals.home}-${f.goals.away}` : "—";
    const min = f.fixture.status.elapsed != null ? `${f.fixture.status.elapsed}'` : "";
    console.log(
      `    [${f.fixture.status.short.padEnd(4)}] ${hh} ${f.teams.home.name} vs ${f.teams.away.name} (${score}) ${min} — ${f.league.name}`,
    );
  }

  console.log("\n✓ smoke-test OK\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
