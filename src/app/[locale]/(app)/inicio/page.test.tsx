import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import type { DashboardData } from "@/server/dashboard/types";

// LiveAutoRefresh usa `useRouter` de next/navigation que requiere
// AppRouterProvider — no disponible en jsdom. Lo mockeamos a no-op.
vi.mock("@/components/dashboard/live-auto-refresh", () => ({
  LiveAutoRefresh: () => null,
}));

const { DashboardSections } = await import("@/components/dashboard/dashboard-sections");

const NOW = new Date("2026-06-12T10:00:00Z");

function buildData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    userName: "Carlos Mendoza",
    stats: {
      totalPoints: 1840,
      streak: 5,
      correctCount: 12,
      achievementsUnlocked: 8,
      achievementsTotal: 24,
      rank: 42,
      totalPlayers: 12480,
    },
    live: null,
    nextMatch: {
      matchId: "next1",
      stage: "group",
      kickoffAt: new Date("2026-06-12T21:00:00Z"),
      homeTeam: { name: "Argentina", flag: "🇦🇷", code: "ARG" },
      awayTeam: { name: "México", flag: "🇲🇽", code: "MEX" },
      prediction: null,
    },
    upcoming: [
      {
        matchId: "m1",
        stage: "group",
        kickoffAt: new Date("2026-06-13T18:00:00Z"),
        homeTeam: { name: "Francia", flag: "🇫🇷", code: "FRA" },
        awayTeam: { name: "Alemania", flag: "🇩🇪", code: "GER" },
        prediction: null,
      },
    ],
    progress: {
      rank: { rank: 42, rankDelta: null, sparkline: null },
      achievements: {
        unlocked: 8,
        total: 24,
        lastUnlockedTitle: "Buen Ojo",
        lastUnlockedAt: NOW,
      },
    },
    mini: {
      global: {
        top: [
          {
            userId: "u1",
            name: "Layla Hassan",
            username: "layla",
            countryCode: "SA",
            points: 4610,
            rank: 1,
          },
        ],
        me: {
          userId: "me",
          name: "Carlos Mendoza",
          username: "carlos",
          countryCode: "MX",
          points: 1840,
          rank: 42,
        },
      },
      friends: { top: [], me: null, friendsCount: 0 },
    },
    ...overrides,
  };
}

describe("<DashboardSections>", () => {
  it("renders the core sections in order", () => {
    renderWithProviders(<DashboardSections data={buildData()} />);
    // "Carlos" aparece dos veces (greeting + mini leaderboard).
    expect(screen.getAllByText(/Carlos/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Próximo partido")).toBeInTheDocument();
    expect(screen.getByText(/Próximos partidos/)).toBeInTheDocument();
    expect(screen.getByText(/Top del momento/)).toBeInTheDocument();
    // El section label "Tu progreso" ya no existe — las cards de
    // progreso se mueven al hero (debajo del nombre), accesibles
    // como enlaces a /logros y /ranking. Verificamos que las cards
    // siguen renderizándose.
    expect(screen.getByLabelText(/Logros desbloqueados/i)).toBeInTheDocument();
  });

  it("achievement progress card links to /logros", () => {
    renderWithProviders(<DashboardSections data={buildData()} />);
    const link = screen.getByRole("link", { name: /Logros desbloqueados/i });
    expect(link.getAttribute("href")).toMatch(/\/logros$/);
  });

  it("rank progress card links to /ranking", () => {
    renderWithProviders(<DashboardSections data={buildData()} />);
    const link = screen.getByRole("link", { name: /Tu posición global/i });
    expect(link.getAttribute("href")).toMatch(/\/ranking$/);
  });

  it("does NOT render the upcoming section when the list is empty", () => {
    renderWithProviders(<DashboardSections data={buildData({ upcoming: [] })} />);
    expect(screen.queryByText(/Próximos partidos/)).not.toBeInTheDocument();
  });

  it("renders 'En vivo ahora' when live is populated", () => {
    renderWithProviders(
      <DashboardSections
        data={buildData({
          live: {
            matchId: "live1",
            stage: "group",
            homeTeam: { name: "España", flag: "🇪🇸", code: "ESP" },
            awayTeam: { name: "Brasil", flag: "🇧🇷", code: "BRA" },
            homeScore: 2,
            awayScore: 1,
            minute: 67,
            prediction: null,
            provisional: null,
          },
          nextMatch: null,
        })}
      />,
    );
    expect(screen.getByText("En vivo ahora")).toBeInTheDocument();
    expect(screen.getByText("España")).toBeInTheDocument();
  });

  it("renders neither live nor next section when both are null", () => {
    renderWithProviders(<DashboardSections data={buildData({ live: null, nextMatch: null })} />);
    expect(screen.queryByText("En vivo ahora")).not.toBeInTheDocument();
    expect(screen.queryByText("Próximo partido")).not.toBeInTheDocument();
  });

  it("renders the history placeholder by default (no rank history yet)", () => {
    renderWithProviders(<DashboardSections data={buildData()} />);
    expect(screen.getByText(/Empezamos a registrar el 11 de junio/)).toBeInTheDocument();
  });
});
