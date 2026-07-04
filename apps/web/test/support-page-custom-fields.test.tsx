import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn()
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["support.view", "support.create", "support.edit"] },
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
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { SupportPage } from "@/pages/support-page";

function optionValue(key: string, label: string, isDefault = false) {
  return { id: `opt-${key}`, key, label, description: null, color: null, isDefault, isActive: true };
}

function buildSupportOptions() {
  return {
    owners: [],
    accounts: [],
    contacts: [],
    statuses: [optionValue("new", "New", true)],
    priorities: [optionValue("medium", "Medium", true)],
    categories: [optionValue("technical", "Technical", true)],
    sources: [optionValue("email", "Email", true)],
    knowledgeCategories: [],
    rootCauses: [],
    breachReasons: [],
    slaPolicies: [],
    availableScopes: ["all", "mine", "team"],
    fieldDefinitions: [
      {
        fieldKey: "tier",
        label: "Support tier",
        description: null,
        dataType: "select",
        placeholder: "Select tier",
        optionSetKey: "support-tier",
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 10,
        settings: {},
        metadata: {}
      },
      {
        fieldKey: "impacted_users",
        label: "Impacted users",
        description: null,
        dataType: "number",
        placeholder: null,
        optionSetKey: null,
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 20,
        settings: {},
        metadata: {}
      }
    ],
    customFieldOptions: {
      "support-tier": [optionValue("gold", "Gold"), optionValue("silver", "Silver")]
    }
  };
}

const emptyDashboard = {
  scope: "all",
  totalTickets: 0,
  openTickets: 0,
  resolvedTickets: 0,
  escalatedTickets: 0,
  slaBreachedTickets: 0,
  unassignedTickets: 0,
  knowledgeArticleCount: 0,
  statusBreakdown: [],
  priorityBreakdown: [],
  categoryBreakdown: []
};

describe("Support page custom fields", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("renders and submits tenant-defined ticket custom fields when creating a ticket", async () => {
    apiRequestMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === "/support/options") {
        return buildSupportOptions();
      }
      if (path === "/support/dashboard") {
        return emptyDashboard;
      }
      // Only the ticket LIST endpoint (optionally with a query string) returns the list shape;
      // ticket sub-resource GETs (detail, intake-assist, investigation, management panels) fall
      // through to the rejection below, which the panels catch and render as empty.
      if ((path === "/support/tickets" || path.startsWith("/support/tickets?")) && (!init || init.method === "GET")) {
        return { tickets: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } };
      }
      if (path === "/support/knowledge-articles") {
        return { articles: [] };
      }
      if (path === "/support/tickets" && init?.method === "POST") {
        return { ticket: { id: "ticket-created" } };
      }
      throw new Error(`Unexpected request: ${path} (${init?.method ?? "GET"})`);
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>
    );

    // Open the create form.
    await user.click(await screen.findByRole("button", { name: "Create ticket" }));

    const tierSelect = await screen.findByLabelText("Support tier");
    await user.type(screen.getByLabelText("Subject"), "Login outage");
    await user.selectOptions(tierSelect, "gold");
    await user.type(screen.getByLabelText("Impacted users"), "42");

    await user.click(screen.getByRole("button", { name: "Create ticket" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/support/tickets",
        expect.objectContaining({
          method: "POST",
          accessToken: "test-token",
          body: expect.objectContaining({
            subject: "Login outage",
            customFields: {
              tier: "gold",
              impacted_users: "42"
            }
          })
        })
      )
    );
  });
});
