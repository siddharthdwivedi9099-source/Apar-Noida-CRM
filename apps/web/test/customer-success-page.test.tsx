import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["customer_success.view"] },
    session: { id: "s1" },
    accessToken: "test-token",
    isAuthenticated: true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    login: vi.fn(),
    logout: vi.fn(),
    reloadCurrentUser: vi.fn()
  })
}));

vi.mock("@/lib/api-client", () => ({
  apiRequest: () => new Promise(() => {}),
  ApiClientError: class ApiClientError extends Error {}
}));

import { CustomerSuccessPage } from "@/pages/customer-success-page";

describe("Customer success dashboard", () => {
  it("mounts and shows its loading surface while the workspace loads", () => {
    const { container } = render(
      <MemoryRouter>
        <CustomerSuccessPage />
      </MemoryRouter>
    );
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByText(/loading customer success workspace/i)).toBeInTheDocument();
  });
});
