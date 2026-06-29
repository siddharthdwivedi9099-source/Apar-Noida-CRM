import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { SalesLeadershipDashboard } from "@/components/sales/sales-leadership-dashboard";

const owner = { id: "u1", displayName: "Asha Rep", email: "asha@example.com", teamName: null, departmentName: null };

function mockApi() {
  apiRequestMock.mockImplementation(async (path: string) => {
    if (path === "/sales-leadership/revenue-dashboard") {
      return { targetAmount: 1000000, achievedAmount: 600000, gap: 400000, pipelineValue: 800000, weightedForecast: 350000, winRate: 60, avgDealSize: 40000, avgCycleDays: 30, renewalPipelineValue: 120000, byTeam: [], filters: { region: null, product: null, segment: null, teamId: null, from: null, to: null }, aiPlaceholder: { available: false, message: "x" } };
    }
    if (path === "/sales-leadership/quotas") {
      return { quotas: [{ id: "q1", name: "APAC Q3", periodType: "quarter", periodStart: "2026-07-01", periodEnd: "2026-09-30", owner, team: null, product: null, region: null, segment: null, targetAmount: 500000, parentQuotaId: null, attainment: { targetAmount: 500000, achievedAmount: 300000, attainmentPercent: 60, gap: 200000, status: "at_risk" }, risk: { projectedAmount: 450000, coverageRatio: 0.9, risk: "medium" }, childCount: 0 }], aiPlaceholder: { available: false, message: "x" } };
    }
    if (path === "/sales-leadership/win-loss") {
      return { totalWon: 6, totalLost: 4, wonValue: 600000, lostValue: 400000, winRate: 60, byLossReason: [{ label: "Price", wonCount: 0, lostCount: 3, wonValue: 0, lostValue: 300000, winRate: 0 }], byCompetitor: [], byRep: [], byProduct: [], bySegment: [], byGeography: [], aiPlaceholder: { available: false, message: "x" } };
    }
    if (path === "/sales-leadership/deal-review-board") {
      return { thresholdAmount: 100000, entries: [{ opportunityId: "o1", name: "Globex Platform", account: null, owner, stage: { id: "s1", key: "negotiation", label: "Negotiation", description: null, color: null, isDefault: false, isActive: true }, amount: 250000, executiveSponsor: null, businessCase: null, competitiveRisk: null, commercials: null, deliveryRisk: null, legalStatus: null, nextAction: null, comments: [] }], aiPlaceholder: { available: false, message: "x" } };
    }
    if (path === "/sales-workspaces/options") {
      return { owners: [owner] };
    }
    return {};
  });
}

describe("SalesLeadershipDashboard", () => {
  beforeEach(() => apiRequestMock.mockReset());

  it("renders revenue, quotas, win/loss, and the deal review board (SH-001..004)", async () => {
    mockApi();
    render(<SalesLeadershipDashboard accessToken="t" canManage />);

    expect(await screen.findByText("Revenue dashboard")).toBeInTheDocument();
    expect(screen.getByText("APAC Q3", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Globex Platform · $250,000.00")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
  });

  it("creates a quota (SH-002) and logs a leadership comment (SH-003)", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<SalesLeadershipDashboard accessToken="t" canManage />);

    await screen.findByText("Quotas");
    await user.type(screen.getByPlaceholderText("Quota name"), "EMEA Annual");
    await user.type(screen.getByPlaceholderText("Target amount"), "750000");
    await user.type(screen.getByLabelText("Period start"), "2026-01-01");
    await user.type(screen.getByLabelText("Period end"), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "Create quota" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/sales-leadership/quotas",
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ name: "EMEA Annual", targetAmount: 750000 }) })
      )
    );

    await user.type(screen.getByPlaceholderText("Leadership comment"), "Escalate to CRO");
    await user.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/sales-leadership/opportunities/o1/leadership-comment",
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ comment: "Escalate to CRO" }) })
      )
    );
  });
});
