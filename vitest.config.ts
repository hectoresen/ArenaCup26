import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next", "drizzle", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      // Solo medimos `src/`; los configs, scripts y migraciones no
      // son lógica de negocio.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/**/types.ts",
        "src/test/**",
        // Fixtures de match-data ya están en repo y se usan solo en tests.
        "src/server/match-data/**/*.fixtures.ts",
        "src/server/scoring/*.fixtures.ts",
        // El sprite SVG y las páginas Next no se prueban a nivel unit
        // — su contrato vivo está en E2E (e2e/public-pages.spec.ts).
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/error.tsx",
        "src/app/**/not-found.tsx",
        "src/components/public-profile/achievement-sprite.tsx",
        "src/app/api/**/route.ts",
        // Service worker no es JS regular.
        "public/sw.js",
      ],
      // Threshold mínimo para que la suite falle si una feature
      // futura empuja el coverage hacia abajo. Los valores actuales
      // (39 / 77 / 50 / 39) reflejan el estado tras extraer helpers
      // puras a su propio archivo en 2026-05-16. La meta mid-term
      // es 60/80/70/60 y la long-term 80+ en todos — ver
      // `docs/testing.md` §"Roadmap de cobertura".
      thresholds: {
        statements: 39,
        branches: 77,
        functions: 50,
        lines: 39,
      },
    },
  },
});
