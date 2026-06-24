import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ login: loginMock })
}));

import { ApiClientError } from "@/lib/api-client";
import { LoginPage } from "@/pages/login-page";

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("Login page", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("renders the sign-in form with tenant, email, and password fields", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/tenant slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("submits the entered credentials to the auth provider", async () => {
    loginMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), "sales.manager@sample-tenant.local");
    await user.type(screen.getByLabelText(/password/i), "Demo@1234");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
    expect(loginMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "sales.manager@sample-tenant.local",
        password: "Demo@1234",
        tenantSlug: expect.any(String)
      })
    );
  });

  it("surfaces an error message when authentication fails", async () => {
    loginMock.mockRejectedValueOnce(new ApiClientError("Invalid credentials.", 401));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), "sales.manager@sample-tenant.local");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
