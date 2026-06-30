import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { CommercialFinancePanel } from "@/components/opportunities/commercial-finance-panel";

const approver = { id: "u1", displayName: "Fin Approver", email: "fin@example.com", teamName: null, departmentName: null };

function buildView() {
  return {
    commercial: {
      opportunityId: "opp-1",
      currency: "USD",
      quote: { lineItems: [{ id: "li1", product: "Platform", quantity: 1, unitPrice: 100000, discountPct: 25, taxPct: 0, lineTotal: 75000 }], implementationFees: 0, recurringFees: 0, paymentTermsKey: "net_30", marginPct: 15, totals: { subtotal: 100000, discountTotal: 25000, taxTotal: 0, feesTotal: 0, total: 75000 }, deviations: ["Discount 25% exceeds the auto-approval ceiling of 10%"], reviewStatus: "pending", reviewedBy: null, reviewComments: null, updatedAt: null },
      discount: { requestedDiscountPct: 25, justification: null, marginImpactPct: null, requirement: { requiresApproval: true, tierKey: "finance", tierLabel: "Finance", approverRole: "finance" }, approvalId: null, approvalStatus: null, state: "required" },
      paymentTerms: { termsKey: "net_30", nonStandard: false, approvedTermsText: null, approvalId: null, approvalStatus: null, state: "not_required" },
      commission: { partnerId: null, partnerName: null, basisAmount: 100000, ratePct: 0, adjustmentAmount: 0, adjustmentReason: null, computedAmount: 0, linkedClosedWon: false, approvalId: null, approvalStatus: null, state: "not_required" }
    }
  };
}

function buildOptions() {
  return {
    paymentTerms: [{ id: "p1", key: "net_30", label: "Net 30", description: null, color: null, isDefault: true, isActive: true }, { id: "p2", key: "milestone", label: "Milestone-based", description: null, color: null, isDefault: false, isActive: true }],
    standardPaymentTermKeys: ["net_30"],
    discountTiers: [],
    maxAutoDiscountPct: 10,
    partners: [{ id: "pt1", name: "Acme Partner" }],
    approvers: [approver]
  };
}

describe("CommercialFinancePanel", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/commercial/options") return buildOptions();
      return buildView();
    });
  });

  it("renders quote totals + deviations and submits a discount for approval (FIN-001/002)", async () => {
    const user = userEvent.setup();
    render(<CommercialFinancePanel opportunityId="opp-1" accessToken="t" canManage />);

    expect(await screen.findByText("Quote review")).toBeInTheDocument();
    expect(screen.getByText(/Deviations: Discount 25%/)).toBeInTheDocument();
    expect(screen.getByText(/Approval required \(Finance\)/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Requested discount %"), "25");
    await user.selectOptions(screen.getAllByRole("combobox").find((el) => (el as HTMLSelectElement).options[0].text === "Approver…")!, "u1");
    await user.click(screen.getByRole("button", { name: "Submit discount" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/commercial/opp-1/discount", expect.objectContaining({ method: "POST", body: expect.objectContaining({ requestedDiscountPct: 25, approverUserId: "u1" }) }))
    );
  });

  it("saves partner commission (FIN-004)", async () => {
    const user = userEvent.setup();
    render(<CommercialFinancePanel opportunityId="opp-1" accessToken="t" canManage />);

    await screen.findByText("Partner commission");
    await user.type(screen.getByPlaceholderText("Rate %"), "10");
    await user.click(screen.getByRole("button", { name: "Save commission" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/commercial/opp-1/commission", expect.objectContaining({ method: "PUT", body: expect.objectContaining({ ratePct: 10 }) }))
    );
  });
});
