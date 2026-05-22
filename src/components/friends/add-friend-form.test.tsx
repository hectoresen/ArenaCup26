import { sendFriendRequest } from "@/server/friends/actions";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddFriendForm } from "./add-friend-form";

const mockedSend = vi.mocked(sendFriendRequest);

describe("<AddFriendForm>", () => {
  beforeEach(() => {
    mockedSend.mockReset();
    mockedSend.mockResolvedValue({ ok: true });
  });

  it("calls sendFriendRequest with the typed username (strips leading @)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddFriendForm />);
    const input = screen.getByPlaceholderText("@username");
    await user.type(input, "@krawer");
    await user.click(screen.getByRole("button", { name: /Enviar/ }));
    expect(mockedSend).toHaveBeenCalledWith("krawer");
  });

  it("shows success feedback after a successful request", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddFriendForm />);
    await user.type(screen.getByPlaceholderText("@username"), "krawer");
    await user.click(screen.getByRole("button", { name: /Enviar/ }));
    expect(await screen.findByText(/Solicitud enviada/)).toBeInTheDocument();
  });

  it("shows the user_not_found error message when action returns that code", async () => {
    mockedSend.mockResolvedValueOnce({ ok: false, code: "user_not_found" });
    const user = userEvent.setup();
    renderWithProviders(<AddFriendForm />);
    await user.type(screen.getByPlaceholderText("@username"), "nobody");
    await user.click(screen.getByRole("button", { name: /Enviar/ }));
    expect(await screen.findByText(/No encontramos a ese username/)).toBeInTheDocument();
  });

  it("submit button is disabled while input is empty", () => {
    renderWithProviders(<AddFriendForm />);
    expect(screen.getByRole("button", { name: /Enviar/ })).toBeDisabled();
  });
});
