import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { LegalReviewPanel } from "@/components/opportunities/legal-review-panel";

const owner = { id: "u1", displayName: "Lead Counsel", email: "legal@example.com", teamName: null, departmentName: null };

function buildView(highRisk = true) {
  return {
    legal: {
      opportunityId: "opp-1",
      initialized: true,
      contractType: { id: "ct1", key: "msa", label: "Master Service Agreement", description: null, color: null, isDefault: false, isActive: true },
      dueDate: "2026-07-10",
      redlines: null,
      riskLevel: "high",
      legalOwner: owner,
      slaStartedAt: new Date().toISOString(),
      slaDueAt: "2026-07-10T00:00:00.000Z",
      slaStatus: "on_track",
      clauses: highRisk ? [{ id: "cl1", title: "Unlimited liability", category: "liability", status: "high_risk", riskNote: null, approvalId: null, approvalStatus: null, resolved: false, createdBy: owner, createdAt: new Date().toISOString() }] : [],
      clauseSummary: { total: highRisk ? 1 : 0, standard: 0, modified: 0, rejected: 0, accepted: 0, highRisk: highRisk ? 1 : 0, unresolvedHighRisk: highRisk ? 1 : 0, hasUnresolvedHighRisk: highRisk },
      contractApproved: false,
      approvedBy: null,
      approvedAt: null,
      signedFileRef: null,
      signedAt: null,
      closureReady: false,
      updatedAt: null
    }
  };
}

function buildOptions() {
  return {
    contractTypes: [{ id: "ct1", key: "msa", label: "Master Service Agreement", description: null, color: null, isDefault: false, isActive: true }],
    riskLevels: ["low", "medium", "high"],
    clauseStatuses: ["standard", "modified", "rejected", "high_risk", "accepted"],
    owners: [owner]
  };
}

describe("LegalReviewPanel", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/legal/options") return buildOptions();
      return buildView(true);
    });
  });

  it("shows unresolved high-risk clause and requests leadership approval (LEG-002)", async () => {
    const user = userEvent.setup();
    render(<LegalReviewPanel opportunityId="opp-1" accessToken="t" canManage />);

    expect(await screen.findByText("Clause deviation tracking")).toBeInTheDocument();
    expect(screen.getByText("Unlimited liability", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Blocked: unresolved high-risk clauses/)).toBeInTheDocument();

    await user.selectOptions(screen.getAllByRole("combobox").find((el) => (el as HTMLSelectElement).options[0].text === "Approver…")!, "u1");
    await user.click(screen.getByRole("button", { name: "Request approval" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/legal/opp-1/clauses/cl1/approval", expect.objectContaining({ method: "POST", body: expect.objectContaining({ approverUserId: "u1" }) }))
    );
  });

  it("adds a clause (LEG-002)", async () => {
    const user = userEvent.setup();
    render(<LegalReviewPanel opportunityId="opp-1" accessToken="t" canManage />);

    await screen.findByText("Clause deviation tracking");
    await user.type(screen.getByPlaceholderText("Clause title"), "IP assignment");
    await user.click(screen.getByRole("button", { name: "Add clause" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/legal/opp-1/clauses", expect.objectContaining({ method: "POST", body: expect.objectContaining({ title: "IP assignment" }) }))
    );
  });
});
