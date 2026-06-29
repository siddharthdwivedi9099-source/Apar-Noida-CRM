import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { BusinessDevelopmentBdm } from "@/components/business-development/business-development-bdm";

function option(key: string, label: string, isDefault = false) {
  return { id: `opt-${key}`, key, label, description: null, color: null, isDefault, isActive: true };
}

function buildOptions() {
  return {
    owners: [{ id: "u1", displayName: "Sales Head", email: "head@example.com", teamName: null, departmentName: null }],
    accounts: [{ id: "acc-1", name: "Globex", website: null }],
    contacts: [],
    tiers: [],
    stages: [],
    partnershipTypes: [],
    availableScopes: ["all"],
    priorities: [],
    technologies: [],
    buyerRoles: [],
    sequenceSteps: [],
    opportunityStages: [],
    marketSignalTypes: [option("competitor", "Competitor insight", true)]
  };
}

function mockApi() {
  apiRequestMock.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/business-development/territory-plans" && (!init || init.method === "GET")) return { territoryPlans: [] };
    if (path === "/business-development/market-signals" && (!init || init.method === "GET")) return { marketSignals: [] };
    if (path === "/business-development/partner-referrals" && (!init || init.method === "GET")) return { referrals: [] };
    return {};
  });
}

describe("BusinessDevelopmentBdm", () => {
  beforeEach(() => apiRequestMock.mockReset());

  it("renders BDM panels and creates a territory plan (BDM-001)", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<BusinessDevelopmentBdm options={buildOptions() as never} accessToken="t" canCreate canUpdate />);

    expect(await screen.findByText("Territory plans")).toBeInTheDocument();
    expect(screen.getByText("Market intelligence")).toBeInTheDocument();
    expect(screen.getByText("Partner referrals")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Plan name"), "APAC Growth");
    await user.click(screen.getByRole("button", { name: "Create plan" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/business-development/territory-plans",
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ name: "APAC Growth" }) })
      )
    );
  });

  it("logs a market signal (BDM-002) and creates a partner referral (BDM-003)", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<BusinessDevelopmentBdm options={buildOptions() as never} accessToken="t" canCreate canUpdate />);

    await screen.findByText("Market intelligence");
    await user.type(screen.getByPlaceholderText("Signal content"), "Competitor cut price 20%");
    await user.click(screen.getByRole("button", { name: "Log signal" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/business-development/market-signals",
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ signalTypeKey: "competitor", content: "Competitor cut price 20%" }) })
      )
    );

    await user.type(screen.getByPlaceholderText("Customer name"), "Initech");
    await user.click(screen.getByRole("button", { name: "Create referral" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/business-development/partner-referrals",
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ customerName: "Initech" }) })
      )
    );
  });
});
