import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn()
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["opportunities.view", "opportunities.create", "opportunities.edit"] },
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

vi.mock("@/providers/tenant-config-provider", () => ({
  useTenantConfig: () => ({
    status: "ready",
    errorMessage: null,
    tenant: null,
    settings: {},
    theme: {},
    modules: [],
    terminology: [],
    summary: {},
    reload: vi.fn(),
    isModuleEnabled: () => true,
    getModuleLabel: (key: string, count?: "singular" | "plural") => (count === "singular" ? "Opportunity" : key)
  })
}));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { OpportunityFormPage } from "@/pages/opportunity-form-page";

function buildOpportunityOptionsResponse() {
  return {
    owners: [],
    accounts: [],
    contacts: [],
    stages: [
      {
        id: "stage-1",
        key: "discovery",
        label: "Discovery",
        description: null,
        color: null,
        isDefault: true,
        isActive: true
      }
    ],
    sources: [
      {
        id: "source-1",
        key: "inbound",
        label: "Inbound",
        description: null,
        color: null,
        isDefault: true,
        isActive: true
      }
    ],
    outcomeStatuses: [
      {
        id: "outcome-1",
        key: "open",
        label: "Open",
        description: null,
        color: null,
        isDefault: true,
        isActive: true
      }
    ],
    availableScopes: ["all"],
    fieldDefinitions: [
      {
        fieldKey: "dealRegion",
        label: "Deal region",
        description: "Used for territory reporting.",
        dataType: "text",
        placeholder: "North India",
        optionSetKey: null,
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 10,
        settings: {},
        metadata: {}
      },
      {
        fieldKey: "partnerType",
        label: "Partner type",
        description: null,
        dataType: "select",
        placeholder: "Select partner type",
        optionSetKey: "partner-type",
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 20,
        settings: {},
        metadata: {}
      },
      {
        fieldKey: "solutionAreas",
        label: "Solution areas",
        description: null,
        dataType: "multiselect",
        placeholder: null,
        optionSetKey: "solution-area",
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 30,
        settings: {},
        metadata: {}
      },
      {
        fieldKey: "strategicDeal",
        label: "Strategic deal",
        description: null,
        dataType: "boolean",
        placeholder: null,
        optionSetKey: null,
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 40,
        settings: {},
        metadata: {}
      }
    ],
    customFieldOptions: {
      "partner-type": [
        {
          id: "partner-1",
          key: "channel",
          label: "Channel Partner",
          description: null,
          color: null,
          isDefault: true,
          isActive: true
        }
      ],
      "solution-area": [
        {
          id: "solution-1",
          key: "erp",
          label: "ERP",
          description: null,
          color: null,
          isDefault: false,
          isActive: true
        },
        {
          id: "solution-2",
          key: "crm",
          label: "CRM",
          description: null,
          color: null,
          isDefault: false,
          isActive: true
        }
      ]
    }
  };
}

function renderOpportunityForm(initialEntry: string, path: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={path} element={<OpportunityFormPage />} />
        <Route path="/opportunities/:opportunityId" element={<div>Opportunity detail route</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Opportunity form", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("mounts inside the create route and shows its loading/preparation surface", () => {
    apiRequestMock.mockImplementation(() => new Promise(() => {}));

    const { container } = renderOpportunityForm("/opportunities/new", "/opportunities/new");

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getAllByText(/loading|preparing/i).length).toBeGreaterThan(0);
  });

  it("submits tenant-defined custom field values when creating an opportunity", async () => {
    apiRequestMock.mockImplementation(async (path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      if (path === "/opportunities/options") {
        return buildOpportunityOptionsResponse();
      }
      if (path === "/opportunities" && init?.method === "POST") {
        return {
          opportunity: {
            id: "opportunity-created"
          }
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const user = userEvent.setup();
    renderOpportunityForm("/opportunities/new", "/opportunities/new");

    await screen.findByLabelText(/Deal region/i);

    await user.type(screen.getByLabelText(/Opportunity name/i), "North Expansion");
    await user.type(screen.getByLabelText(/Deal region/i), "North India");
    await user.selectOptions(screen.getByLabelText(/Partner type/i), "channel");
    await user.click(screen.getByRole("button", { name: "ERP" }));
    await user.click(screen.getByRole("button", { name: "CRM" }));
    await user.selectOptions(screen.getByLabelText(/Strategic deal/i), "true");
    await user.click(screen.getByRole("button", { name: "Create Opportunity" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/opportunities",
        expect.objectContaining({
          method: "POST",
          accessToken: "test-token",
          body: expect.objectContaining({
            name: "North Expansion",
            stageKey: "discovery",
            sourceKey: "inbound",
            outcomeStatusKey: "open",
            customFields: {
              dealRegion: "North India",
              partnerType: "channel",
              solutionAreas: ["erp", "crm"],
              strategicDeal: true
            }
          })
        })
      )
    );
  });

  it("loads saved custom field values when editing an opportunity", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/opportunities/options") {
        return buildOpportunityOptionsResponse();
      }
      if (path === "/opportunities/opportunity-1") {
        return {
          opportunity: {
            id: "opportunity-1",
            name: "North Expansion",
            account: null,
            primaryContact: null,
            owner: null,
            stage: {
              id: "stage-1",
              key: "discovery",
              label: "Discovery",
              description: null,
              color: null,
              isDefault: true,
              isActive: true
            },
            source: {
              id: "source-1",
              key: "inbound",
              label: "Inbound",
              description: null,
              color: null,
              isDefault: true,
              isActive: true
            },
            outcomeStatus: {
              id: "outcome-1",
              key: "open",
              label: "Open",
              description: null,
              color: null,
              isDefault: true,
              isActive: true
            },
            amount: 20000,
            probability: 30,
            expectedCloseDate: "2026-07-15",
            competitor: "Competitor One",
            nextStep: "Follow up",
            winLossReason: null,
            stakeholderCount: 0,
            noteCount: 0,
            activityCount: 0,
            lastActivityAt: null,
            lastStageChangedAt: "2026-06-27T10:00:00.000Z",
            metadata: {},
            customFields: {
              dealRegion: "West UP",
              partnerType: "channel",
              solutionAreas: ["crm"],
              strategicDeal: false
            },
            createdAt: "2026-06-26T10:00:00.000Z",
            updatedAt: "2026-06-27T10:00:00.000Z",
            stakeholders: [],
            notes: [],
            activities: [],
            tasks: [],
            timeline: [],
            productsServicesPlaceholder: {
              available: false,
              message: "Products/services placeholder"
            },
            forecastPlaceholder: {
              available: false,
              message: "Forecast placeholder"
            },
            dealRiskPlaceholder: {
              available: false,
              message: "Risk placeholder"
            },
            aiPlaceholders: {
              actions: [],
              governanceHint: "Hint"
            }
          }
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderOpportunityForm("/opportunities/opportunity-1/edit", "/opportunities/:opportunityId/edit");

    expect(await screen.findByDisplayValue("West UP")).toBeInTheDocument();
    expect(screen.getByLabelText(/Partner type/i)).toHaveValue("channel");
    expect(screen.getByLabelText(/Strategic deal/i)).toHaveValue("false");
    expect(screen.getByRole("button", { name: /crm/i })).toHaveAttribute("aria-pressed", "true");
  });
});
