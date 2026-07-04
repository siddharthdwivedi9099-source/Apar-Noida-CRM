import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn()
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["accounts.view", "accounts.edit"] },
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
    getModuleLabel: (key: string, count?: "singular" | "plural") => (count === "singular" ? "Account" : key)
  })
}));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
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

import { AccountDetailPage } from "@/pages/account-detail-page";

function renderAccountDetailPage() {
  return render(
    <MemoryRouter initialEntries={["/accounts/account-1"]}>
      <Routes>
        <Route path="/accounts/:accountId" element={<AccountDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Account detail page", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("renders saved tenant-defined custom fields with friendly labels", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/accounts/account-1") {
        return {
          account: {
            id: "account-1",
            name: "Apar Demo School",
            website: "https://apar.example.test",
            industry: "Education",
            accountType: {
              id: "account-type-1",
              key: "prospect",
              label: "Prospect",
              description: null,
              color: null,
              isDefault: true,
              isActive: true
            },
            healthStatus: {
              id: "health-1",
              key: "healthy",
              label: "Healthy",
              description: null,
              color: null,
              isDefault: true,
              isActive: true
            },
            owner: null,
            contactCount: 0,
            noteCount: 0,
            activityCount: 0,
            metadata: {},
            customFields: {
              territory: "North India",
              board: "cbse"
            },
            createdAt: "2026-06-26T10:00:00.000Z",
            updatedAt: "2026-06-27T10:00:00.000Z",
            notes: [],
            activities: [],
            tasks: [],
            timeline: [],
            relatedContacts: [],
            relatedOpportunitiesPlaceholder: {
              available: false,
              message: "Opportunity linkage lives elsewhere."
            }
          }
        };
      }
      if (path === "/accounts/options") {
        return {
          owners: [],
          accountTypes: [],
          healthStatuses: [],
          fieldDefinitions: [
            {
              fieldKey: "territory",
              label: "Territory",
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
          }
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderAccountDetailPage();

    expect(await screen.findByText("Apar Demo School")).toBeInTheDocument();
    expect(screen.getByText("Territory")).toBeInTheDocument();
    expect(screen.getByText("North India")).toBeInTheDocument();
    expect(screen.getByText("CBSE")).toBeInTheDocument();
  });
});
