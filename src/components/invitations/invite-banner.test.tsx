import { dismissInviteCookie } from "@/server/invitations/actions";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteBanner } from "./invite-banner";

const mockedDismiss = vi.mocked(dismissInviteCookie);

describe("<InviteBanner>", () => {
  beforeEach(() => {
    mockedDismiss.mockReset();
    mockedDismiss.mockResolvedValue({ ok: true });
  });

  it("renders the inviter name in <em> with gold tone", () => {
    const { container } = renderWithProviders(
      <InviteBanner inviterName="Krawer" inviterUsername="krawer" />,
    );
    const em = container.querySelector("em");
    expect(em?.textContent).toBe("Krawer");
    expect(screen.getByText(/Krawer/)).toBeInTheDocument();
  });

  it("renders the auto-friendship subtitle", () => {
    renderWithProviders(<InviteBanner inviterName="Krawer" inviterUsername="krawer" />);
    expect(screen.getByText(/amigos autom/i)).toBeInTheDocument();
  });

  it("calls dismissInviteCookie when the × button is clicked and hides the banner", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <InviteBanner inviterName="Krawer" inviterUsername="krawer" />,
    );
    await user.click(screen.getByRole("button", { name: /Descartar/ }));
    expect(mockedDismiss).toHaveBeenCalledOnce();
    // El banner se oculta optimistically tras el click.
    expect(container.querySelector("aside[role='status']")).toBeNull();
  });

  it("uses role='status' for accessibility", () => {
    const { container } = renderWithProviders(
      <InviteBanner inviterName="Krawer" inviterUsername="krawer" />,
    );
    expect(container.querySelector("aside[role='status']")).not.toBeNull();
  });
});
