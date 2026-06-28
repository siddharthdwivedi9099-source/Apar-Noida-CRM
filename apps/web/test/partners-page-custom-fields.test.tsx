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
    user: { id: "u1", permissionCodes: ["partners.view", "partners.create", "partners.edit"] },
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

import { PartnersPage } from "@/pages/partners-page";

function optionValue(key: string, label: string, isDefault = false) {
  return { id: `opt-${key}`, key, label, description: null, color: null, isDefault, isActive: true };
}

function buildPartnerOptions() {
  return {
    owners: [],
    accounts: [],
    contacts: [],
    opportunities: [],
    types: [optionValue("reseller", "Reseller", true)],
    tiers: [optionValue("gold", "Gold", true)],
    statuses: [optionValue("active", "Active", true)],
    onboardingStatuses: [optionValue("not_started", "Not started", true)],
    dealStages: [optionValue("discovery", "Discovery", true)],
    availableScopes: ["all", "mine", "team"],
    fieldDefinitions: [
      {
        fieldKey: "channel_segment",
        label: "Channel segment",
        description: null,
        dataType: "select",
        placeholder: "Select segment",
        optionSetKey: "partner-segment",
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 10,
        settings: {},
        metadata: {}
      },
      {
        fieldKey: "quota",
        label: "Annual quota",
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
      "partner-segment": [optionValue("smb", "SMB"), optionValue("enterprise", "Enterprise")]
    }
  };
}

const emptyDashboard = {
  scope: "all",
  totalPartners: 0,
  activePartners: 0,
  onboardingInProgress: 0,
  registeredDealCount: 0,
  registeredDealValue: 0,
  wonDealCount: 0,
  tierDistribution: [],
  statusDistribution: [],
  typeDistribution: [],
  performancePlaceholder: { available: false, message: "n/a" }
};

describe("Partners page custom fields", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("renders and submits tenant-defined partner custom fields when creating a partner", async () => {
    apiRequestMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === "/partners/options") {
        return buildPartnerOptions();
      }
      if (path === "/partners/dashboard") {
        return emptyDashboard;
      }
      if (path.startsWith("/partners?") && (!init || init.method === "GET")) {
        return { partners: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } };
      }
      if (path === "/partners" && init?.method === "POST") {
        return { partner: { id: "partner-created" } };
      }
      throw new Error(`Unexpected request: ${path} (${init?.method ?? "GET"})`);
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PartnersPage />
      </MemoryRouter>
    );

    // Open the create form.
    await user.click(await screen.findByRole("button", { name: "Add partner" }));

    const segmentSelect = await screen.findByLabelText("Channel segment");
    await user.type(screen.getByLabelText("Partner name"), "Acme Channel");
    await user.selectOptions(segmentSelect, "enterprise");
    await user.type(screen.getByLabelText("Annual quota"), "500000");

    await user.click(screen.getByRole("button", { name: "Create partner" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/partners",
        expect.objectContaining({
          method: "POST",
          accessToken: "test-token",
          body: expect.objectContaining({
            name: "Acme Channel",
            typeKey: "reseller",
            tierKey: "gold",
            customFields: {
              channel_segment: "enterprise",
              quota: "500000"
            }
          })
        })
      )
    );
  });
});
