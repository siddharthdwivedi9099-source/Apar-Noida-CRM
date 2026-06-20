import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["ai.view", "ai.manage_ai"] },
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

// Keep network calls pending so the page renders its initial loading surface.
vi.mock("@/lib/api-client", () => ({
  apiRequest: () => new Promise(() => {}),
  ApiClientError: class ApiClientError extends Error {}
}));

import { AiAssistantPage } from "@/pages/ai-assistant-page";

describe("AI assistant panel", () => {
  it("mounts and shows its loading surface while the gateway data loads", () => {
    const { container } = render(
      <MemoryRouter>
        <AiAssistantPage />
      </MemoryRouter>
    );
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByText(/loading ai gateway/i)).toBeInTheDocument();
  });
});
