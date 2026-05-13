import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { NotificationBell } from "./notification-bell";

describe("<NotificationBell>", () => {
  it("does not show a badge when unreadCount is 0", () => {
    const { container } = renderWithProviders(<NotificationBell unreadCount={0} />);
    expect(screen.getByRole("button", { name: /Notificaciones$/ })).toBeInTheDocument();
    // El badge tiene `aria-hidden` y un texto numérico; sin notificaciones, no existe.
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("shows the badge with the count when unreadCount > 0", () => {
    renderWithProviders(<NotificationBell unreadCount={3} />);
    const button = screen.getByRole("button", { name: /3 sin leer/ });
    expect(button).toBeInTheDocument();
    expect(button.textContent).toContain("3");
  });

  it("collapses very high counts to '99+'", () => {
    renderWithProviders(<NotificationBell unreadCount={250} />);
    const button = screen.getByRole("button", { name: /250 sin leer/ });
    expect(button.textContent).toContain("99+");
  });

  it("aria-label carries the count, badge stays aria-hidden", () => {
    const { container } = renderWithProviders(<NotificationBell unreadCount={5} />);
    expect(screen.getByRole("button", { name: /5 sin leer/ })).toBeInTheDocument();
    // Hay dos [aria-hidden=true]: el svg del icono y el badge. El badge es el
    // único `<span>`.
    const badge = container.querySelector("span[aria-hidden='true']");
    expect(badge?.textContent).toBe("5");
  });
});
