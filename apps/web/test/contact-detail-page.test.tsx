import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn()
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["contacts.view", "contacts.edit"] },
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
    getModuleLabel: (key: string, count?: "singular" | "plural") => (count === "singular" ? "Contact" : key)
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

import { ContactDetailPage } from "@/pages/contact-detail-page";

function renderContactDetailPage() {
  return render(
    <MemoryRouter initialEntries={["/contacts/contact-1"]}>
      <Routes>
        <Route path="/contacts/:contactId" element={<ContactDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Contact detail page", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("renders saved tenant-defined custom fields with friendly labels", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/contacts/contact-1") {
        return {
          contact: {
            id: "contact-1",
            firstName: "Taylor",
            lastName: "Buyer",
            fullName: "Taylor Buyer",
            email: "taylor@example.test",
            phone: "+1-415-555-0111",
            linkedinUrl: null,
            role: {
              id: "role-1",
              key: "decision_maker",
              label: "Decision maker",
              description: null,
              color: null,
              isDefault: true,
              isActive: true
            },
            owner: null,
            account: null,
            noteCount: 0,
            activityCount: 0,
            metadata: {},
            customFields: {
              department: "Procurement",
              seniority: "manager"
            },
            createdAt: "2026-06-26T10:00:00.000Z",
            updatedAt: "2026-06-27T10:00:00.000Z",
            notes: [],
            activities: [],
            tasks: [],
            timeline: []
          }
        };
      }
      if (path === "/contacts/options") {
        return {
          owners: [],
          roles: [],
          accounts: [],
          fieldDefinitions: [
            {
              fieldKey: "department",
              label: "Department",
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
              fieldKey: "seniority",
              label: "Seniority",
              description: null,
              dataType: "select",
              placeholder: null,
              optionSetKey: "seniority-level",
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
            "seniority-level": [
              {
                id: "seniority-1",
                key: "manager",
                label: "Manager",
                description: null,
                color: null,
                isDefault: false,
                isActive: true
              }
            ]
          }
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderContactDetailPage();

    expect(await screen.findByText("Department")).toBeInTheDocument();
    expect(screen.getByText("Procurement")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
  });
});
