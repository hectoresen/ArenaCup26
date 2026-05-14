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
});
