import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { OpportunityEnterpriseActions } from "@/components/opportunities/opportunity-enterprise-actions";

function option(key: string, label: string, isDefault = false) {
  return { id: `opt-${key}`, key, label, description: null, color: null, isDefault, isActive: true };
}

function buildOptions() {
  return {
    owners: [{ id: "u1", displayName: "Lead Approver", email: "lead@example.com", teamName: null, departmentName: null }],
    accounts: [],
    contacts: [],
    stages: [option("discovery", "Discovery", true)],
    sources: [option("inbound", "Inbound", true)],
    outcomeStatuses: [option("open", "Open", true)],
    availableScopes: ["all"],
    fieldDefinitions: [],
    customFieldOptions: {},
    discoveryFields: [],
    stakeholderRoles: [],
    proposalTemplates: [],
    lossReasons: [],
    tenderChecklistItems: [{ key: "emd_proof", label: "EMD proof", required: true, sortOrder: 0 }]
  };
}

function buildDetail() {
  return {
    id: "opp-1",
    name: "Gov Tender",
    account: null,
    enterprise: {
      parentOpportunityId: null,
      parent: null,
      children: [{ id: "c1", name: "Phase 1", stageKey: "discovery", stageLabel: "Discovery", amount: 50000, probability: 40, expectedCloseDate: null }],
      rollup: { childCount: 1, totalValue: 50000, weightedValue: 20000, byStage: [{ stageKey: "discovery", stageLabel: "Discovery", count: 1, value: 50000 }] },
      tender: {
        tenderNumber: "T-9",
        issuingAuthority: "Authority",
        deadline: null,
        eligibility: null,
        scope: null,
        preBidDate: null,
        emd: null,
        commercialFormat: null,
        checklist: { emd_proof: false },
        tasksGenerated: false,
        updatedAt: null,
        checklistItems: [{ key: "emd_proof", label: "EMD proof", required: true, completed: false }],
        completionCount: 0,
        total: 1,
        requiredComplete: false,
        missingDocuments: ["EMD proof"]
      },
      dealReview: { solutionFit: "Fit", pricing: "OK", legal: "OK", risk: "Low", deliveryReadiness: "Ready", leadershipSupport: "Yes", status: "draft", approvalId: null, updatedAt: null },
      dealReviewThreshold: 100000,
      dealReviewRequired: true,
      dealReviewComplete: true
    }
  };
}

describe("OpportunityEnterpriseActions", () => {
  beforeEach(() => apiRequestMock.mockReset());

  it("renders roll-up, tender (with missing docs), and governance (ES-002/003/005)", async () => {
    apiRequestMock.mockResolvedValue({});
    render(<OpportunityEnterpriseActions detail={buildDetail() as never} options={buildOptions() as never} accessToken="t" canEdit onReload={vi.fn()} />);

    expect(screen.getByText("Multi-opportunity roll-up")).toBeInTheDocument();
    expect(screen.getByText("Phase 1")).toBeInTheDocument();
    expect(screen.getByText(/Missing: EMD proof/)).toBeInTheDocument();
    expect(screen.getByText(/Review required for this deal value/)).toBeInTheDocument();
  });

  it("submits the deal review for approval (ES-005)", async () => {
    apiRequestMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<OpportunityEnterpriseActions detail={buildDetail() as never} options={buildOptions() as never} accessToken="t" canEdit onReload={vi.fn()} />);

    const approverSelect = screen.getByText("Approver").parentElement?.querySelector("select") as HTMLSelectElement;
    await user.selectOptions(approverSelect, "u1");
    await user.click(screen.getByRole("button", { name: "Submit for approval" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/opportunities/opp-1/deal-review",
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ submitForApproval: true, approverUserId: "u1" }) })
      )
    );
  });
});
