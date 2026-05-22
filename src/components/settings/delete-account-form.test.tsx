import { deleteAccount } from "@/server/users/delete-account";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock del router — jsdom no tiene el provider del App Router de
// Next montado y `useRouter()` falla con "invariant expected app
// router to be mounted". Sustituimos por noops; el flujo del form
// no depende de la navegación real (solo se llama tras `ok: true`).
vi.mock("@/i18n/navigation", async () => {
  const actual = await vi.importActual<typeof import("@/i18n/navigation")>("@/i18n/navigation");
  return {
    ...actual,
    useRouter: () => ({
      replace: vi.fn(),
      refresh: vi.fn(),
      push: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});

// Importar después del mock.
const { DeleteAccountForm } = await import("./delete-account-form");
const mockedDelete = vi.mocked(deleteAccount);

describe("<DeleteAccountForm>", () => {
  beforeEach(() => {
    mockedDelete.mockReset();
    mockedDelete.mockResolvedValue({ ok: true });
  });

  it("disables the submit button until both gates pass", () => {
    renderWithProviders(<DeleteAccountForm />);
    const btn = screen.getByRole("button", { name: /Eliminar mi cuenta para siempre/ });
    expect(btn).toBeDisabled();
  });

  it("enables the submit button when checkbox + exact phrase are typed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteAccountForm />);
    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByPlaceholderText("ELIMINAR MI CUENTA"), "ELIMINAR MI CUENTA");
    expect(screen.getByRole("button", { name: /Eliminar mi cuenta para siempre/ })).toBeEnabled();
  });

  it("does NOT enable submit if only the checkbox is ticked (phrase blank)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteAccountForm />);
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /Eliminar mi cuenta para siempre/ })).toBeDisabled();
  });

  it("does NOT enable submit if phrase is typed but checkbox missing", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteAccountForm />);
    await user.type(screen.getByPlaceholderText("ELIMINAR MI CUENTA"), "ELIMINAR MI CUENTA");
    expect(screen.getByRole("button", { name: /Eliminar mi cuenta para siempre/ })).toBeDisabled();
  });

  it("calls deleteAccount with the exact phrase on submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteAccountForm />);
    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByPlaceholderText("ELIMINAR MI CUENTA"), "ELIMINAR MI CUENTA");
    await user.click(screen.getByRole("button", { name: /Eliminar mi cuenta para siempre/ }));
    expect(mockedDelete).toHaveBeenCalledWith("ELIMINAR MI CUENTA");
  });

  it("shows confirmation_mismatch error when server returns that code", async () => {
    mockedDelete.mockResolvedValueOnce({ ok: false, code: "confirmation_mismatch" });
    const user = userEvent.setup();
    renderWithProviders(<DeleteAccountForm />);
    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByPlaceholderText("ELIMINAR MI CUENTA"), "ELIMINAR MI CUENTA");
    await user.click(screen.getByRole("button", { name: /Eliminar mi cuenta para siempre/ }));
    expect(await screen.findByText(/no coincide/i)).toBeInTheDocument();
  });
});
