import type {
  LeaderboardEntry,
  MiniLeaderboardData,
  MiniLeaderboardView,
} from "@/server/dashboard/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { MiniLeaderboard } from "./mini-leaderboard";

function entry(rank: number, userId: string, points = 5000 - rank * 100): LeaderboardEntry {
  return {
    userId,
    name: `User ${userId.toUpperCase()}`,
    username: `user-${userId}`,
    countryCode: "MX",
    points,
    rank,
    isOnline: false,
  };
}

/**
 * Helper: construye un `MiniLeaderboardData` con el global poblado y
 * el subset de amigos vacío (sin amigos), o ambos si se proveen.
 */
function buildMini(
  global: MiniLeaderboardView,
  friends?: { top: LeaderboardEntry[]; me: LeaderboardEntry | null; friendsCount?: number },
): MiniLeaderboardData {
  return {
    global,
    friends: friends
      ? { ...friends, friendsCount: friends.friendsCount ?? friends.top.length }
      : { top: [], me: null, friendsCount: 0 },
  };
}

describe("<MiniLeaderboard>", () => {
  const top: LeaderboardEntry[] = [entry(1, "u1"), entry(2, "u2"), entry(3, "u3")];

  it("renders the top entries", () => {
    const mini = buildMini({ top, me: null });
    renderWithProviders(<MiniLeaderboard mini={mini} active="global" />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("renders the separator + me row when me is outside the top", () => {
    const mini = buildMini({
      top,
      me: { ...entry(42, "me", 1840), name: "Carlos Mendoza" },
    });
    const { container } = renderWithProviders(
      <MiniLeaderboard mini={mini} active="global" />,
    );
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getByText("Carlos Mendoza", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/\(tú\)/)).toBeInTheDocument();
    expect(container.querySelector("[data-testid='mini-leaderboard-separator']")).not.toBeNull();
  });

  it("hides separator + (tú) when me is null (already in top)", () => {
    const mini = buildMini({ top, me: null });
    const { container } = renderWithProviders(
      <MiniLeaderboard mini={mini} active="global" />,
    );
    expect(container.querySelector("[data-testid='mini-leaderboard-separator']")).toBeNull();
    expect(screen.queryByText(/\(tú\)/)).not.toBeInTheDocument();
  });

  it("formats points with es-ES separator", () => {
    const mini = buildMini({
      top: [{ ...entry(1, "u1"), points: 4610 }],
      me: null,
    });
    renderWithProviders(<MiniLeaderboard mini={mini} active="global" />);
    expect(screen.getByText("4.610")).toBeInTheDocument();
  });

  it("aria-label for 'me' row mentions 'Tu posición'", () => {
    const mini = buildMini({
      top,
      me: { ...entry(42, "me", 1840), name: "Carlos" },
    });
    renderWithProviders(<MiniLeaderboard mini={mini} active="global" />);
    // El aria-label vive ahora en el <Link> (no en el <li>) porque
    // toda la fila es clicable a /u/<username>.
    expect(screen.getByRole("link", { name: /Tu posición.*42/ })).toBeInTheDocument();
  });

  it("renders 'Ver ranking completo' CTA linking to /ranking", () => {
    const mini = buildMini({ top, me: null });
    renderWithProviders(<MiniLeaderboard mini={mini} active="global" />);
    const link = screen.getByRole("link", { name: /Ver ranking completo/ });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toMatch(/\/ranking$/);
  });

  it("does NOT render the tabs when user has 0 friends", () => {
    const mini = buildMini({ top, me: null });
    renderWithProviders(<MiniLeaderboard mini={mini} active="global" />);
    expect(screen.queryByRole("link", { name: "Global" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Amigos" })).toBeNull();
  });

  it("renders the tabs when user has ≥1 friend", () => {
    const mini = buildMini(
      { top, me: null },
      {
        top: [{ ...entry(1, "fr1"), name: "Krawer" }],
        me: null,
        friendsCount: 3,
      },
    );
    renderWithProviders(<MiniLeaderboard mini={mini} active="global" />);
    expect(screen.getByRole("link", { name: "Global" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Amigos" })).toBeInTheDocument();
  });

  it("active=amigos renders the friends view, not the global one", () => {
    const mini = buildMini(
      { top, me: null },
      {
        top: [{ ...entry(1, "fr1"), name: "Krawer", points: 9999 }],
        me: null,
        friendsCount: 2,
      },
    );
    renderWithProviders(<MiniLeaderboard mini={mini} active="amigos" />);
    // El top del global tenía U U1 (User U1) — no debería aparecer.
    expect(screen.queryByText("User U1")).toBeNull();
    // El top de amigos tiene Krawer.
    expect(screen.getByText("Krawer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Amigos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("falls back to global if active=amigos but user has 0 friends", () => {
    const mini = buildMini({ top, me: null }); // friends vacío
    renderWithProviders(<MiniLeaderboard mini={mini} active="amigos" />);
    // El global se renderiza, no la lista vacía de amigos.
    expect(screen.getByText("User U1")).toBeInTheDocument();
  });

  it("shows empty-state copy when friends view has 0 entries (edge race)", () => {
    // friendsCount > 0 (tab visible) pero top vacío — caso raro pero
    // posible si los amigos no tienen user_points (acabaron de
    // registrarse). El widget debería mostrar el copy específico.
    const mini = buildMini(
      { top, me: null },
      { top: [], me: null, friendsCount: 1 },
    );
    renderWithProviders(<MiniLeaderboard mini={mini} active="amigos" />);
    expect(screen.getByText(/Aún no tienes amigos/i)).toBeInTheDocument();
  });

  it("each row with a username is a clickable link to /u/<username>", () => {
    const mini = buildMini({ top, me: null });
    const { container } = renderWithProviders(<MiniLeaderboard mini={mini} active="global" />);
    expect(container.querySelector('a[href$="/u/user-u1"]')).not.toBeNull();
  });

  it("renders 'me' row as link when username is present", () => {
    const mini = buildMini({
      top,
      me: { ...entry(42, "me", 1840), name: "Carlos", username: "carlos-test" },
    });
    const { container } = renderWithProviders(<MiniLeaderboard mini={mini} active="global" />);
    expect(container.querySelector('a[href$="/u/carlos-test"]')).not.toBeNull();
  });

  it("falls back to non-clickable li when username is null", () => {
    const mini = buildMini({
      top: [{ ...entry(1, "noname"), username: null }],
      me: null,
    });
    const { container } = renderWithProviders(<MiniLeaderboard mini={mini} active="global" />);
    expect(container.querySelector('a[href*="/u/"]')).toBeNull();
  });
});
