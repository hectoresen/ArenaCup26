import { acceptFriendRequest, sendFriendRequest } from "@/server/friends/actions";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendActionButton } from "./friend-action-button";

const mockedSend = vi.mocked(sendFriendRequest);
const mockedAccept = vi.mocked(acceptFriendRequest);

const baseProps = {
  targetUsername: "krawer",
  targetUserId: "00000000-0000-0000-0000-000000000001",
} as const;

describe("<FriendActionButton>", () => {
  beforeEach(() => {
    mockedSend.mockReset();
    mockedAccept.mockReset();
    mockedSend.mockResolvedValue({ ok: true });
    mockedAccept.mockResolvedValue({ ok: true });
  });

  it("renders nothing for relation=self", () => {
    const { container } = renderWithProviders(
      <FriendActionButton {...baseProps} initialRelation="self" />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders 'Añadir amigo' button when relation=none and calls send on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FriendActionButton {...baseProps} initialRelation="none" />);
    const btn = screen.getByRole("button", { name: /Añadir amigo/ });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(mockedSend).toHaveBeenCalledWith("krawer");
  });

  it("renders 'Solicitud enviada' (disabled state) when relation=pending-out", () => {
    renderWithProviders(<FriendActionButton {...baseProps} initialRelation="pending-out" />);
    expect(screen.getByText(/Solicitud enviada/)).toBeInTheDocument();
  });

  it("renders 'Aceptar solicitud' when relation=pending-in and calls accept on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <FriendActionButton
        {...baseProps}
        initialRelation="pending-in"
        pendingFriendshipId="friendship-1"
      />,
    );
    const btn = screen.getByRole("button", { name: /Aceptar solicitud/ });
    await user.click(btn);
    expect(mockedAccept).toHaveBeenCalledWith("friendship-1");
  });

  it("renders 'Amigos' badge when relation=accepted", () => {
    renderWithProviders(<FriendActionButton {...baseProps} initialRelation="accepted" />);
    expect(screen.getByText(/Amigos/)).toBeInTheDocument();
  });

  it("hides the button for blocked relations", () => {
    const { container: byMe } = renderWithProviders(
      <FriendActionButton {...baseProps} initialRelation="blocked-by-me" />,
    );
    const { container: byThem } = renderWithProviders(
      <FriendActionButton {...baseProps} initialRelation="blocked-by-them" />,
    );
    expect(byMe.textContent).toBe("");
    expect(byThem.textContent).toBe("");
  });
});
