import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn()
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["opportunities.view", "opportunities.edit"] },
    session: { id: "session-1" },
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

vi.mock("@/components/crm/bpf-stage-progress", () => ({
  BpfStageProgress: () => <div>Stage progress</div>
}));

vi.mock("@/components/crm/crm-notes-panel", () => ({
  CrmNotesPanel: () => <div>Notes panel</div>
}));

vi.mock("@/components/crm/crm-activity-panel", () => ({
  CrmActivityPanel: () => <div>Activity panel</div>
}));

vi.mock("@/components/crm/crm-task-list", () => ({
  CrmTaskList: () => <div>Task list</div>
}));

vi.mock("@/components/crm/crm-timeline", () => ({
  CrmTimeline: () => <div>Timeline</div>
}));

import { OpportunityDetailPage } from "@/pages/opportunity-detail-page";

function renderOpportunityDetailPage() {
  return render(
    <MemoryRouter initialEntries={["/opportunities/opportunity-1"]}>
      <Routes>
        <Route path="/opportunities/:opportunityId" element={<OpportunityDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Opportunity detail page", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("renders saved tenant-defined custom fields with friendly labels", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
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
              dealRegion: "North India",
              partnerType: "channel"
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
            },
            execWorkspace: {
              acceptance: { status: "pending", acceptedAt: null, rejectedReason: null, slaStartedAt: null },
              discovery: { items: [], completionCount: 0, total: 0, requiredCount: 0, requiredComplete: true },
              buyingCommittee: { score: 0, total: 0, covered: 0, roles: [], missingRoles: [] },
              negotiation: {
                commercialAsks: null,
                legalAsks: null,
                procurementBlockers: null,
                competitorOffers: null,
                finalPrice: null,
                nextAction: null,
                updatedAt: null
              },
              proposal: null,
              discount: {
                percent: null,
                justification: null,
                competitorContext: null,
                marginImpact: null,
                value: null,
                closeProbability: null,
                status: "none",
                approvalId: null,
                requestedAt: null
              },
              demo: null,
              closeWon: null,
              closeLost: null,
              stageRequirement: { stageKey: "discovery", requiredFields: [], missingFields: [], satisfied: true }
            }
          }
        };
      }
      if (path === "/opportunities/options") {
        return {
          owners: [],
          accounts: [],
          contacts: [],
          stages: [],
          sources: [],
          outcomeStatuses: [],
          availableScopes: ["all"],
          discoveryFields: [],
          stakeholderRoles: [],
          proposalTemplates: [],
          lossReasons: [{ id: "lr-1", key: "budget", label: "Budget", description: null, color: null, isDefault: true, isActive: true }],
          fieldDefinitions: [
            {
              fieldKey: "dealRegion",
              label: "Deal region",
              description: null,
              dataType: "text",
              placeholder: null,
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
              placeholder: null,
              optionSetKey: "partner-type",
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
            ]
          }
        };
      }
      if (path === "/leads/options") {
        return {
          leadForOptions: [],
          productOptions: [],
          technologyOptions: []
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderOpportunityDetailPage();

    expect(await screen.findByText("North Expansion")).toBeInTheDocument();
    expect(screen.getByText("Deal region")).toBeInTheDocument();
    expect(screen.getByText("North India")).toBeInTheDocument();
    expect(screen.getByText("Channel Partner")).toBeInTheDocument();
  });
});
