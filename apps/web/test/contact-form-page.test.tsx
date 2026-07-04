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
    user: { id: "u1", permissionCodes: ["contacts.view", "contacts.create", "contacts.edit"] },
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
    getModuleLabel: (key: string, count?: "singular" | "plural") => (count === "singular" ? "Contact" : key)
  })
}));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { ContactFormPage } from "@/pages/contact-form-page";

function buildContactOptionsResponse() {
  return {
    owners: [],
    roles: [
      {
        id: "role-1",
        key: "decision_maker",
        label: "Decision maker",
        description: null,
        color: null,
        isDefault: true,
        isActive: true
      }
    ],
    accounts: [
      {
        id: "account-1",
        name: "Apar Demo School",
        website: null
      }
    ],
    fieldDefinitions: [
      {
        fieldKey: "department",
        label: "Department",
        description: "Owning department for this stakeholder.",
        dataType: "text",
        placeholder: "Department name",
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
        placeholder: "Select seniority",
        optionSetKey: "seniority-level",
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 20,
        settings: {},
        metadata: {}
      },
      {
        fieldKey: "channels",
        label: "Channels",
        description: null,
        dataType: "multiselect",
        placeholder: null,
        optionSetKey: "channel-type",
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 30,
        settings: {},
        metadata: {}
      },
      {
        fieldKey: "decision_owner",
        label: "Decision owner",
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
      "seniority-level": [
        {
          id: "seniority-1",
          key: "c_level",
          label: "C-level",
          description: null,
          color: null,
          isDefault: true,
          isActive: true
        },
        {
          id: "seniority-2",
          key: "manager",
          label: "Manager",
          description: null,
          color: null,
          isDefault: false,
          isActive: true
        }
      ],
      "channel-type": [
        {
          id: "channel-1",
          key: "email",
          label: "Email",
          description: null,
          color: null,
          isDefault: false,
          isActive: true
        },
        {
          id: "channel-2",
          key: "phone",
          label: "Phone",
          description: null,
          color: null,
          isDefault: false,
          isActive: true
        }
      ]
    }
  };
}

function renderContactForm(initialEntry: string, path: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={path} element={<ContactFormPage />} />
        <Route path="/contacts/:contactId" element={<div>Contact detail route</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Contact form", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("mounts inside the create route and shows its loading/preparation surface", () => {
    apiRequestMock.mockImplementation(() => new Promise(() => {}));

    const { container } = renderContactForm("/contacts/new", "/contacts/new");

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getAllByText(/loading|preparing/i).length).toBeGreaterThan(0);
  });

  it("submits tenant-defined custom field values when creating a contact", async () => {
    apiRequestMock.mockImplementation(async (path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      if (path === "/contacts/options") {
        return buildContactOptionsResponse();
      }
      if (path === "/contacts" && init?.method === "POST") {
        return {
          contact: {
            id: "contact-created"
          }
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const user = userEvent.setup();
    renderContactForm("/contacts/new", "/contacts/new");

    await screen.findByLabelText(/Department/i);

    await user.type(screen.getByLabelText("First name"), "Taylor");
    await user.type(screen.getByLabelText("Last name"), "Buyer");
    await user.type(screen.getByLabelText(/Department/i), "Procurement");
    await user.selectOptions(screen.getByLabelText("Seniority"), "manager");
    await user.click(screen.getByRole("button", { name: "Email" }));
    await user.click(screen.getByRole("button", { name: "Phone" }));
    await user.selectOptions(screen.getByLabelText("Decision owner"), "true");
    await user.click(screen.getByRole("button", { name: "Create Contact" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/contacts",
        expect.objectContaining({
          method: "POST",
          accessToken: "test-token",
          body: expect.objectContaining({
            firstName: "Taylor",
            lastName: "Buyer",
            roleKey: "decision_maker",
            customFields: {
              department: "Procurement",
              seniority: "manager",
              channels: ["email", "phone"],
              decision_owner: true
            }
          })
        })
      )
    );
  });

  it("loads saved custom field values when editing a contact", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/contacts/options") {
        return buildContactOptionsResponse();
      }
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
            account: {
              id: "account-1",
              name: "Apar Demo School",
              website: null
            },
            noteCount: 0,
            activityCount: 0,
            metadata: {},
            customFields: {
              department: "Operations",
              seniority: "c_level",
              channels: ["phone"],
              decision_owner: false
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
      throw new Error(`Unexpected request: ${path}`);
    });

    renderContactForm("/contacts/contact-1/edit", "/contacts/:contactId/edit");

    expect(await screen.findByDisplayValue("Operations")).toBeInTheDocument();
    expect(screen.getByLabelText("Seniority")).toHaveValue("c_level");
    expect(screen.getByLabelText("Decision owner")).toHaveValue("false");
    expect(screen.getByRole("button", { name: /phone/i })).toHaveAttribute("aria-pressed", "true");
  });
});
