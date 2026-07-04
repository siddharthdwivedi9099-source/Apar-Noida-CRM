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
    user: { id: "u1", permissionCodes: ["accounts.view", "accounts.create", "accounts.edit"] },
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
    getModuleLabel: (key: string, count?: "singular" | "plural") => (count === "singular" ? "Account" : key)
  })
}));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { AccountFormPage } from "@/pages/account-form-page";

function buildAccountOptionsResponse() {
  return {
    owners: [],
    accountTypes: [
      {
        id: "account-type-1",
        key: "prospect",
        label: "Prospect",
        description: null,
        color: null,
        isDefault: true,
        isActive: true
      }
    ],
    healthStatuses: [
      {
        id: "health-1",
        key: "healthy",
        label: "Healthy",
        description: null,
        color: null,
        isDefault: true,
        isActive: true
      }
    ],
    fieldDefinitions: [
      {
        fieldKey: "territory",
        label: "Territory",
        description: "Used for regional routing.",
        dataType: "text",
        placeholder: "Territory name",
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
        label: "Strategic account",
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
    }
  };
}

function renderAccountForm(initialEntry: string, path: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={path} element={<AccountFormPage />} />
        <Route path="/accounts/:accountId" element={<div>Account detail route</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Account form", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("mounts inside the create route and shows its loading/preparation surface", () => {
    apiRequestMock.mockImplementation(() => new Promise(() => {}));

    const { container } = renderAccountForm("/accounts/new", "/accounts/new");

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getAllByText(/loading|preparing/i).length).toBeGreaterThan(0);
  });

  it("submits tenant-defined custom field values when creating an account", async () => {
    apiRequestMock.mockImplementation(async (path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      if (path === "/accounts/options") {
        return buildAccountOptionsResponse();
      }
      if (path === "/accounts" && init?.method === "POST") {
        return {
          account: {
            id: "account-created"
          }
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const user = userEvent.setup();
    renderAccountForm("/accounts/new", "/accounts/new");

    await screen.findByLabelText(/Territory/i);

    await user.type(screen.getByLabelText("Account name"), "Apar Demo School");
    await user.type(screen.getByLabelText("Website"), "https://apar.example.test");
    await user.type(screen.getByLabelText("Industry"), "Education");
    await user.type(screen.getByLabelText(/Territory/i), "North India");
    await user.selectOptions(screen.getByLabelText("Board"), "cbse");
    await user.click(screen.getByRole("button", { name: "Primary" }));
    await user.click(screen.getByRole("button", { name: "Secondary" }));
    await user.selectOptions(screen.getByLabelText("Strategic account"), "true");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/accounts",
        expect.objectContaining({
          method: "POST",
          accessToken: "test-token",
          body: expect.objectContaining({
            name: "Apar Demo School",
            website: "https://apar.example.test",
            industry: "Education",
            accountTypeKey: "prospect",
            healthStatusKey: "healthy",
            customFields: {
              territory: "North India",
              board: "cbse",
              campuses: ["primary", "secondary"],
              strategic: true
            }
          })
        })
      )
    );
  });

  it("loads saved custom field values when editing an account", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/accounts/options") {
        return buildAccountOptionsResponse();
      }
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
              territory: "West UP",
              board: "icse",
              campuses: ["secondary"],
              strategic: false
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
              message: "Opportunities are not attached yet."
            }
          }
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderAccountForm("/accounts/account-1/edit", "/accounts/:accountId/edit");

    expect(await screen.findByDisplayValue("West UP")).toBeInTheDocument();
    expect(screen.getByLabelText("Board")).toHaveValue("icse");
    expect(screen.getByLabelText("Strategic account")).toHaveValue("false");
    expect(screen.getByRole("button", { name: /secondary/i })).toHaveAttribute("aria-pressed", "true");
  });
});
