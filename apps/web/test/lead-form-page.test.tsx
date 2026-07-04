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
    user: { id: "u1", permissionCodes: ["leads.view", "leads.create", "leads.edit"] },
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
    getModuleLabel: (key: string, count?: "singular" | "plural") => (count === "singular" ? "Lead" : key)
  })
}));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { LeadFormPage } from "@/pages/lead-form-page";

function buildLeadOptionsResponse() {
  return {
    owners: [],
    statuses: [
      {
        id: "status-1",
        key: "new",
        label: "New",
        description: null,
        color: null,
        isDefault: true,
        isActive: true
      }
    ],
    sources: [
      {
        id: "source-1",
        key: "website",
        label: "Website",
        description: null,
        color: null,
        isDefault: true,
        isActive: true
      }
    ],
    fieldDefinitions: [
      {
        fieldKey: "district",
        label: "District",
        description: "Region-specific routing.",
        dataType: "text",
        placeholder: "District name",
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
        placeholder: "Select board",
        optionSetKey: "school-board",
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 20,
        settings: {},
        metadata: {}
      },
      {
        fieldKey: "campuses",
        label: "Campuses",
        description: null,
        dataType: "multiselect",
        placeholder: null,
        optionSetKey: "campus-type",
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 30,
        settings: {},
        metadata: {}
      },
      {
        fieldKey: "strategic",
        label: "Strategic lead",
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
      "school-board": [
        {
          id: "board-1",
          key: "cbse",
          label: "CBSE",
          description: null,
          color: null,
          isDefault: true,
          isActive: true
        },
        {
          id: "board-2",
          key: "icse",
          label: "ICSE",
          description: null,
          color: null,
          isDefault: false,
          isActive: true
        }
      ],
      "campus-type": [
        {
          id: "campus-1",
          key: "primary",
          label: "Primary",
          description: null,
          color: null,
          isDefault: false,
          isActive: true
        },
        {
          id: "campus-2",
          key: "secondary",
          label: "Secondary",
          description: null,
          color: null,
          isDefault: false,
          isActive: true
        }
      ]
    },
    leadForOptions: [
      {
        id: "lead-for-1",
        key: "other",
        label: "Other",
        description: null,
        color: null,
        isDefault: true,
        isActive: true
      }
    ],
    technologyOptions: [],
    productOptions: []
  };
}

function renderLeadForm(initialEntry: string, path: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={path} element={<LeadFormPage />} />
        <Route path="/leads/:leadId" element={<div>Lead detail route</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Lead form", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("mounts inside the create route and shows its loading/preparation surface", () => {
    apiRequestMock.mockImplementation(() => new Promise(() => {}));

    const { container } = renderLeadForm("/leads/new", "/leads/new");

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getAllByText(/loading|preparing/i).length).toBeGreaterThan(0);
  });

  it("submits tenant-defined custom field values when creating a lead", async () => {
    apiRequestMock.mockImplementation(async (path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      if (path === "/leads/options") {
        return buildLeadOptionsResponse();
      }
      if (path === "/leads" && init?.method === "POST") {
        return {
          lead: {
            id: "lead-created"
          }
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const user = userEvent.setup();
    renderLeadForm("/leads/new", "/leads/new");

    await screen.findByLabelText(/District/i);

    await user.type(screen.getByLabelText("First name"), "Asha");
    await user.type(screen.getByLabelText("Last name"), "Singh");
    await user.type(screen.getByLabelText("Company"), "Apar Demo School");
    await user.type(screen.getByLabelText(/District/i), "Lucknow");
    await user.selectOptions(screen.getByLabelText("Board"), "cbse");
    await user.click(screen.getByRole("button", { name: "Primary" }));
    await user.click(screen.getByRole("button", { name: "Secondary" }));
    await user.selectOptions(screen.getByLabelText("Strategic lead"), "true");
    await user.click(screen.getByRole("button", { name: "Create Lead" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leads",
        expect.objectContaining({
          method: "POST",
          accessToken: "test-token",
          body: expect.objectContaining({
            firstName: "Asha",
            lastName: "Singh",
            companyName: "Apar Demo School",
            statusKey: "new",
            sourceKey: "website",
            metadata: expect.objectContaining({
              leadFor: "other"
            }),
            customFields: {
              district: "Lucknow",
              board: "cbse",
              campuses: ["primary", "secondary"],
              strategic: true
            }
          })
        })
      )
    );
  });

  it("loads saved custom field values when editing a lead", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/leads/options") {
        return buildLeadOptionsResponse();
      }
      if (path === "/leads/lead-1") {
        return {
          lead: {
            id: "lead-1",
            firstName: "Asha",
            lastName: "Singh",
            fullName: "Asha Singh",
            companyName: "Apar Demo School",
            email: null,
            phone: null,
            status: {
              id: "status-1",
              key: "new",
              label: "New",
              description: null,
              color: null,
              isDefault: true,
              isActive: true
            },
            source: {
              id: "source-1",
              key: "website",
              label: "Website",
              description: null,
              color: null,
              isDefault: true,
              isActive: true
            },
            score: null,
            owner: null,
            noteCount: 0,
            activityCount: 0,
            lastActivityAt: null,
            metadata: {
              leadFor: "other"
            },
            customFields: {
              district: "Kanpur",
              board: "icse",
              campuses: ["secondary"],
              strategic: false
            },
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
      throw new Error(`Unexpected request: ${path}`);
    });

    renderLeadForm("/leads/lead-1/edit", "/leads/:leadId/edit");

    expect(await screen.findByDisplayValue("Kanpur")).toBeInTheDocument();
    expect(screen.getByLabelText("Board")).toHaveValue("icse");
    expect(screen.getByLabelText("Strategic lead")).toHaveValue("false");
    expect(screen.getByRole("button", { name: /secondary/i })).toHaveAttribute("aria-pressed", "true");
  });
});
