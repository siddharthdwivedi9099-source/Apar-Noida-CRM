import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn()
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["leads.view", "leads.edit"] },
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
    getModuleLabel: (key: string, count?: "singular" | "plural") => (count === "singular" ? "Lead" : key)
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

import { LeadDetailPage } from "@/pages/lead-detail-page";

function renderLeadDetailPage() {
  return render(
    <MemoryRouter initialEntries={["/leads/lead-1"]}>
      <Routes>
        <Route path="/leads/:leadId" element={<LeadDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Lead detail page", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("renders the lead detail even when runtime guidance cannot be loaded", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/leads/lead-1") {
        return {
          lead: {
            id: "lead-1",
            firstName: "Asha",
            lastName: "Singh",
            fullName: "Asha Singh",
            companyName: "Apar Demo School",
            email: "asha@example.com",
            phone: "+91 99999 00000",
            status: { id: "status-1", key: "new", label: "New", description: null, color: null, isDefault: true, isActive: true },
            source: { id: "source-1", key: "partner", label: "Partner", description: null, color: null, isDefault: true, isActive: true },
            score: 72,
            owner: null,
            noteCount: 0,
            activityCount: 0,
            lastActivityAt: "2026-06-26T10:00:00.000Z",
            customFields: {
              district: "Lucknow",
              board: "cbse"
            },
            metadata: {},
            createdAt: "2026-06-25T10:00:00.000Z",
            updatedAt: "2026-06-26T10:00:00.000Z",
            notes: [],
            activities: [],
            tasks: [],
            timeline: [],
            conversion: null,
            conversionPlaceholder: {
              available: false,
              message: "Conversion is not available yet."
            }
          }
        };
      }
      if (path === "/leads/options") {
        return {
          owners: [],
          statuses: [],
          sources: [],
          fieldDefinitions: [
            {
              fieldKey: "district",
              label: "District",
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
              fieldKey: "board",
              label: "Board",
              description: null,
              dataType: "select",
              placeholder: null,
              optionSetKey: "school-board",
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
            "school-board": [
              {
                id: "board-1",
                key: "cbse",
                label: "CBSE",
                description: null,
                color: null,
                isDefault: true,
                isActive: true
              }
            ]
          },
          leadForOptions: [],
          technologyOptions: [],
          productOptions: []
        };
      }
      if (path === "/leads/lead-1/runtime") {
        throw new Error("Runtime guidance service unavailable.");
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderLeadDetailPage();

    expect(await screen.findByText("Apar Demo School")).toBeInTheDocument();
    expect(screen.getByText("Runtime guidance is temporarily unavailable for this lead.")).toBeInTheDocument();
    expect(screen.getByText("Runtime guidance service unavailable.")).toBeInTheDocument();
    expect(screen.getByText("District")).toBeInTheDocument();
    expect(screen.getByText("Lucknow")).toBeInTheDocument();
    expect(screen.getByText("CBSE")).toBeInTheDocument();
    expect(screen.queryByText("This lead could not be loaded.")).not.toBeInTheDocument();
  });

  it("renders the conversion summary when the lead has already been converted", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/leads/lead-1") {
        return {
          lead: {
            id: "lead-1",
            firstName: "Asha",
            lastName: "Singh",
            fullName: "Asha Singh",
            companyName: "Apar Demo School",
            email: "asha@example.com",
            phone: "+91 99999 00000",
            status: { id: "status-2", key: "converted", label: "Converted", description: null, color: null, isDefault: false, isActive: true },
            source: { id: "source-1", key: "partner", label: "Partner", description: null, color: null, isDefault: true, isActive: true },
            score: 88,
            owner: null,
            noteCount: 0,
            activityCount: 0,
            lastActivityAt: "2026-06-26T10:00:00.000Z",
            customFields: {},
            metadata: {},
            createdAt: "2026-06-25T10:00:00.000Z",
            updatedAt: "2026-06-26T10:00:00.000Z",
            notes: [],
            activities: [],
            tasks: [],
            timeline: [],
            conversion: {
              convertedAt: "2026-06-26T11:00:00.000Z",
              convertedByUserId: "user-1",
              account: { id: "account-1", name: "Apar Demo School", website: null },
              accountLinkMode: "created",
              contact: { id: "contact-1", fullName: "Asha Singh", email: "asha@example.com", role: null },
              contactLinkMode: "created",
              opportunity: {
                id: "opp-1",
                name: "Apar Demo School Opportunity",
                stage: { id: "stage-1", key: "qualification", label: "Qualification", description: null, color: null, isDefault: false, isActive: true }
              },
              handoffTask: {
                id: "task-1",
                relatedRecord: { type: "opportunity", id: "opp-1" },
                title: "Review lead handoff for Apar Demo School",
                description: "Qualified budget, authority, need, and timeline.",
                dueAt: "2026-06-27T11:00:00.000Z",
                reminderAt: null,
                priority: "medium",
                status: "open",
                owner: null,
                assignee: null,
                createdAt: "2026-06-26T11:00:00.000Z",
                updatedAt: "2026-06-26T11:00:00.000Z",
                metadata: {}
              },
              duplicateCheckCompletedAt: "2026-06-26T11:00:00.000Z",
              duplicateMatches: {
                accountMatches: [],
                contactMatches: []
              },
              qualificationSummary: "Qualified budget, authority, need, and timeline."
            },
            conversionPlaceholder: {
              available: false,
              message: "Lead conversion has been completed for this record."
            }
          }
        };
      }
      if (path === "/leads/options") {
        return {
          owners: [],
          statuses: [],
          sources: [],
          fieldDefinitions: [],
          customFieldOptions: {},
          leadForOptions: [],
          technologyOptions: [],
          productOptions: []
        };
      }
      if (path === "/leads/lead-1/runtime") {
        return {
          leadId: "lead-1",
          generatedAt: "2026-06-26T10:00:00.000Z",
          scoring: null,
          mql: null,
          assignment: null,
          sla: null,
          configGaps: [],
          deferredRuntimeActions: []
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderLeadDetailPage();

    expect(await screen.findByText("Conversion summary")).toBeInTheDocument();
    expect(screen.getByText("Apar Demo School Opportunity")).toBeInTheDocument();
    expect(screen.getByText("Review lead handoff for Apar Demo School")).toBeInTheDocument();
    expect(screen.getByText("Linked via created account record.")).toBeInTheDocument();
  });
});
