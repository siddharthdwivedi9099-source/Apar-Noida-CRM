import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { OpportunityExecActions } from "@/components/opportunities/opportunity-exec-actions";

function option(key: string, label: string, isDefault = false) {
  return { id: `opt-${key}`, key, label, description: null, color: null, isDefault, isActive: true };
}

function buildOptions() {
  return {
    owners: [{ id: "u1", displayName: "Asha AE", email: "asha@example.com", teamName: null, departmentName: null }],
    accounts: [],
    contacts: [],
    stages: [option("discovery", "Discovery", true)],
    sources: [option("inbound", "Inbound", true)],
    outcomeStatuses: [option("open", "Open", true)],
    availableScopes: ["all"],
    fieldDefinitions: [],
    customFieldOptions: {},
    discoveryFields: [{ key: "budget", label: "Budget", description: null, required: true, sortOrder: 0 }],
    stakeholderRoles: [option("decision_maker", "Decision Maker")],
    proposalTemplates: [option("standard", "Standard", true)],
    lossReasons: [option("budget", "Budget", true)]
  };
}

function buildDetail() {
  return {
    id: "opp-1",
    name: "Globex Expansion",
    stakeholders: [],
    execWorkspace: {
      acceptance: { status: "pending", acceptedAt: null, rejectedReason: null, slaStartedAt: null },
      discovery: {
        items: [{ key: "budget", label: "Budget", required: true, value: "", completed: false }],
        completionCount: 0,
        total: 1,
        requiredCount: 1,
        requiredComplete: false
      },
      buyingCommittee: { score: 0, total: 1, covered: 0, roles: [{ key: "decision_maker", label: "Decision Maker", covered: false }], missingRoles: [{ key: "decision_maker", label: "Decision Maker", covered: false }] },
      negotiation: { commercialAsks: null, legalAsks: null, procurementBlockers: null, competitorOffers: null, finalPrice: null, nextAction: null, updatedAt: null },
      proposal: null,
      discount: { percent: null, justification: null, competitorContext: null, marginImpact: null, value: null, closeProbability: null, status: "none", approvalId: null, requestedAt: null },
      demo: null,
      closeWon: null,
      closeLost: null,
      stageRequirement: { stageKey: "discovery", requiredFields: [], missingFields: [], satisfied: true }
    }
  };
}

describe("OpportunityExecActions", () => {
  beforeEach(() => apiRequestMock.mockReset());

  it("renders the AE workspace and accepts the opportunity (AE-001)", async () => {
    apiRequestMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <OpportunityExecActions detail={buildDetail() as never} options={buildOptions() as never} accessToken="t" canEdit onReload={vi.fn()} />
    );

    expect(screen.getByText("Ownership & SLA")).toBeInTheDocument();
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText(/Missing: Decision Maker/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept opportunity" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/opportunities/opp-1/accept", expect.objectContaining({ method: "POST" }))
    );
  });

  it("requests a governed discount (AE-007)", async () => {
    apiRequestMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <OpportunityExecActions detail={buildDetail() as never} options={buildOptions() as never} accessToken="t" canEdit onReload={vi.fn()} />
    );

    await user.type(screen.getByPlaceholderText("Discount %"), "15");
    await user.type(screen.getByPlaceholderText("Justification"), "Competitive pressure");
    const approverSelects = screen.getAllByRole("combobox");
    const discountApprover = approverSelects.find((select) => select.previousElementSibling === null && select.innerHTML.includes("Approver"));
    // Select the approver in the discount block (last "Approver…" select before the discount button).
    const allApproverSelects = approverSelects.filter((select) => select.innerHTML.includes("Approver"));
    await user.selectOptions(allApproverSelects[allApproverSelects.length - 1] ?? (discountApprover as HTMLSelectElement), "u1");
    await user.click(screen.getByRole("button", { name: "Request discount" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/opportunities/opp-1/discount",
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ percent: 15, approverUserId: "u1" }) })
      )
    );
  });
});
