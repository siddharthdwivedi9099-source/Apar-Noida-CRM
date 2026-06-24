import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock, authState } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  authState: {
    accessToken: "token-1",
    user: { id: "u1", permissionCodes: ["dashboards.view"] as string[] }
  }
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: authState.user,
    session: { id: "session-1" },
    accessToken: authState.accessToken,
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
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { AnalyticsDashboardsPage } from "@/pages/analytics-dashboards-page";

function dashboardCatalog(dashboards: Array<{ key: string; name: string; category: string; permitted: boolean; widgetCount?: number }>) {
  return {
    dashboards: dashboards.map((dashboard) => ({
      key: dashboard.key,
      name: dashboard.name,
      category: dashboard.category,
      description: `${dashboard.name} description`,
      widgetCount: dashboard.widgetCount ?? 1,
      permitted: dashboard.permitted
    })),
    categories: Array.from(new Set(dashboards.map((dashboard) => dashboard.category)))
  };
}

function dashboardData(key: string, label: string) {
  return {
    key,
    name: `${label} dashboard`,
    category: key,
    filter: { from: null, to: null },
    generatedAt: "2026-06-25T00:00:00.000Z",
    widgets: [
      {
        key: `${key}-widget`,
        label,
        type: "metric" as const,
        metricKey: `${key}_metric`,
        kind: "scalar" as const,
        drilldown: false,
        value: 42,
        unit: null,
        breakdown: [],
        series: [],
        rows: [],
        note: null
      }
    ]
  };
}

function renderAnalyticsDashboardsPage() {
  return render(
    <MemoryRouter>
      <AnalyticsDashboardsPage />
    </MemoryRouter>
  );
}

describe("Analytics dashboards page", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    authState.accessToken = "token-1";
    authState.user = { id: "u1", permissionCodes: ["dashboards.view"] };
    window.localStorage.clear();
  });

  it("opens the saved default dashboard for the current user when it is permitted", async () => {
    window.localStorage.setItem("crm:default-dashboard:u1", "executive");
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/dashboards") {
        return dashboardCatalog([
          { key: "sales", name: "Sales dashboard", category: "sales", permitted: true },
          { key: "executive", name: "Executive dashboard", category: "executive", permitted: true }
        ]);
      }
      if (path === "/dashboards/executive") {
        return dashboardData("executive", "Executive widget");
      }
      if (path === "/dashboards/executive/views") {
        return { views: [] };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderAnalyticsDashboardsPage();

    expect(await screen.findByText("Executive widget")).toBeInTheDocument();
    expect(screen.queryByText("Sales widget")).not.toBeInTheDocument();
  });

  it("switches to the new user's permitted default dashboard after a login change", async () => {
    window.localStorage.setItem("crm:default-dashboard:u1", "sales");
    window.localStorage.setItem("crm:default-dashboard:u2", "support");
    apiRequestMock.mockImplementation(async (path: string, options?: { accessToken?: string | null }) => {
      if (path === "/dashboards" && options?.accessToken === "token-1") {
        return dashboardCatalog([
          { key: "sales", name: "Sales dashboard", category: "sales", permitted: true },
          { key: "support", name: "Support dashboard", category: "support", permitted: false }
        ]);
      }
      if (path === "/dashboards" && options?.accessToken === "token-2") {
        return dashboardCatalog([
          { key: "sales", name: "Sales dashboard", category: "sales", permitted: false },
          { key: "support", name: "Support dashboard", category: "support", permitted: true }
        ]);
      }
      if (path === "/dashboards/sales") {
        return dashboardData("sales", "Sales widget");
      }
      if (path === "/dashboards/sales/views") {
        return { views: [] };
      }
      if (path === "/dashboards/support") {
        return dashboardData("support", "Support widget");
      }
      if (path === "/dashboards/support/views") {
        return { views: [] };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const { rerender } = renderAnalyticsDashboardsPage();

    expect(await screen.findByText("Sales widget")).toBeInTheDocument();

    authState.accessToken = "token-2";
    authState.user = { id: "u2", permissionCodes: ["dashboards.view"] };

    rerender(
      <MemoryRouter>
        <AnalyticsDashboardsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Support widget")).toBeInTheDocument();
    expect(screen.queryByText("Sales widget")).not.toBeInTheDocument();
  });
});
