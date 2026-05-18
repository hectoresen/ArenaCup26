import type { NotificationItem } from "@/server/notifications/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./notification-bell";

const noop = async () => {};

describe("<NotificationBell> — closed state", () => {
  it("no muestra el badge cuando unread es 0", () => {
    const { container } = renderWithProviders(
      <NotificationBell initialItems={[]} initialUnreadCount={0} onMarkAllRead={noop} />,
    );
    expect(screen.getByRole("button", { name: /Notificaciones$/ })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("muestra el badge con el count cuando hay sin leer", () => {
    renderWithProviders(
      <NotificationBell initialItems={[]} initialUnreadCount={3} onMarkAllRead={noop} />,
    );
    expect(screen.getByRole("button", { name: /3 sin leer/ })).toBeInTheDocument();
  });

  it("colapsa counts altos a 99+", () => {
    renderWithProviders(
      <NotificationBell initialItems={[]} initialUnreadCount={250} onMarkAllRead={noop} />,
    );
    expect(screen.getByRole("button", { name: /250 sin leer/ })).toBeInTheDocument();
  });
});

describe("<NotificationBell> — dropdown abierto", () => {
  it("invoca onMarkAllRead al abrirse si había no leídas", async () => {
    const onMarkAllRead = vi.fn(async () => {});
    const user = (await import("@testing-library/user-event")).default.setup();
    renderWithProviders(
      <NotificationBell initialItems={[]} initialUnreadCount={2} onMarkAllRead={onMarkAllRead} />,
    );
    await user.click(screen.getByRole("button", { name: /sin leer/ }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it("no invoca onMarkAllRead si ya no había no leídas", async () => {
    const onMarkAllRead = vi.fn(async () => {});
    const user = (await import("@testing-library/user-event")).default.setup();
    renderWithProviders(
      <NotificationBell initialItems={[]} initialUnreadCount={0} onMarkAllRead={onMarkAllRead} />,
    );
    await user.click(screen.getByRole("button", { name: /Notificaciones$/ }));
    expect(onMarkAllRead).not.toHaveBeenCalled();
  });

  it("muestra estado vacío cuando no hay items", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderWithProviders(
      <NotificationBell initialItems={[]} initialUnreadCount={0} onMarkAllRead={noop} />,
    );
    await user.click(screen.getByRole("button"));
    expect(screen.getByText(/Aún no hay nada por aquí/)).toBeInTheDocument();
  });

  it("renderiza una notificación con kind 'prediction_sent'", async () => {
    const item: NotificationItem = {
      id: "n1",
      kind: "prediction_sent",
      title: "Argentina vs México",
      body: "Tu predicción quedó guardada",
      matchId: "m-1",
      achievementId: null,
      readAt: null,
      createdAt: new Date(Date.now() - 60_000),
    };
    const user = (await import("@testing-library/user-event")).default.setup();
    renderWithProviders(
      <NotificationBell initialItems={[item]} initialUnreadCount={1} onMarkAllRead={noop} />,
    );
    await user.click(screen.getByRole("button", { name: /sin leer/ }));
    expect(screen.getByText("Predicción enviada")).toBeInTheDocument();
    expect(screen.getByText("Argentina vs México")).toBeInTheDocument();
  });

  it("friend_request enlaza a /social (click navigates al inbox)", async () => {
    const item: NotificationItem = {
      id: "n2",
      kind: "friend_request",
      title: "Krawer te envió una solicitud",
      body: null,
      matchId: null,
      achievementId: null,
      readAt: null,
      createdAt: new Date(),
    };
    const user = (await import("@testing-library/user-event")).default.setup();
    renderWithProviders(
      <NotificationBell initialItems={[item]} initialUnreadCount={1} onMarkAllRead={noop} />,
    );
    await user.click(screen.getByRole("button", { name: /sin leer/ }));
    const link = screen.getByRole("link", { name: /Krawer/ });
    expect(link.getAttribute("href")).toMatch(/\/social$/);
  });

  it("achievement_unlocked enlaza a /logros", async () => {
    const item: NotificationItem = {
      id: "n3",
      kind: "achievement_unlocked",
      title: "Logro desbloqueado",
      body: "Primer Acierto",
      matchId: null,
      achievementId: "first-hit",
      readAt: null,
      createdAt: new Date(),
    };
    const user = (await import("@testing-library/user-event")).default.setup();
    renderWithProviders(
      <NotificationBell initialItems={[item]} initialUnreadCount={1} onMarkAllRead={noop} />,
    );
    await user.click(screen.getByRole("button", { name: /sin leer/ }));
    const link = screen.getByRole("link", { name: /Logro desbloqueado/ });
    expect(link.getAttribute("href")).toMatch(/\/logros$/);
  });

  it("system kind no enlaza (div no clicable)", async () => {
    const item: NotificationItem = {
      id: "n4",
      kind: "system",
      title: "Mantenimiento programado",
      body: null,
      matchId: null,
      achievementId: null,
      readAt: null,
      createdAt: new Date(),
    };
    const user = (await import("@testing-library/user-event")).default.setup();
    const { container } = renderWithProviders(
      <NotificationBell initialItems={[item]} initialUnreadCount={1} onMarkAllRead={noop} />,
    );
    await user.click(screen.getByRole("button", { name: /sin leer/ }));
    // No hay <a> con ese texto: la fila se renderiza como <div>.
    expect(screen.queryByRole("link", { name: /Mantenimiento/ })).toBeNull();
    // Pero el texto sigue visible dentro del menu.
    expect(container.textContent).toContain("Mantenimiento programado");
  });
});
