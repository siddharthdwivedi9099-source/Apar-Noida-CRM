import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api-client")>();
  return { ...actual, apiRequest: apiRequestMock };
});

import { ApiClientError } from "@/lib/api-client";
import { AuthProvider, useAuth } from "@/providers/auth-provider";

// A minimal protected surface that mirrors the router's ProtectedRoute decision:
// it relies on the real AuthProvider to decide whether the user is authenticated.
function Protected() {
  const { status, isAuthenticated, hasPermission, login } = useAuth();
  if (status === "loading") {
    return <p>Loading session…</p>;
  }
  if (!isAuthenticated) {
    return (
      <div>
        <p>Redirected to login</p>
        <button
          type="button"
          onClick={() =>
            login({ tenantSlug: "sample-tenant", email: "admin@sample-tenant.local", password: "ChangeMe123!" })
          }
        >
          Sign in
        </button>
      </div>
    );
  }
  return <p>Protected workspace ({hasPermission("leads.view") ? "can-view-leads" : "no-leads"})</p>;
}

function renderProtected() {
  return render(
    <AuthProvider>
      <Protected />
    </AuthProvider>
  );
}

describe("Protected route", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("treats a session with no refresh token as unauthenticated", async () => {
    apiRequestMock.mockRejectedValue(new ApiClientError("No active session.", 401));
    renderProtected();
    expect(await screen.findByText(/redirected to login/i)).toBeInTheDocument();
  });

  it("grants access after a successful login and exposes the user's permissions", async () => {
    // Initial bootstrap refresh fails -> unauthenticated.
    apiRequestMock.mockImplementation((path: string) => {
      if (path === "/auth/refresh") {
        return Promise.reject(new ApiClientError("No active session.", 401));
      }
      if (path === "/auth/login") {
        return Promise.resolve({
          tokens: { accessToken: "access-token" },
          user: { id: "u1", permissionCodes: ["leads.view"] },
          session: { id: "s1" }
        });
      }
      if (path === "/auth/me") {
        return Promise.resolve({
          user: { id: "u1", permissionCodes: ["leads.view"] },
          session: { id: "s1" }
        });
      }
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });

    const user = userEvent.setup();
    renderProtected();

    await screen.findByText(/redirected to login/i);
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/protected workspace/i)).toBeInTheDocument());
    expect(screen.getByText(/can-view-leads/i)).toBeInTheDocument();
  });
});
