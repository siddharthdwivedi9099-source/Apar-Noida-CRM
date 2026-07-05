import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { SalesManagerDashboard } from "@/components/sales/sales-manager-dashboard";

const owner = { id: "u1", displayName: "Asha Rep", email: "asha@example.com", teamName: null, departmentName: null };

function mockApi() {
  apiRequestMock.mockImplementation(async (path: string, _init?: { method?: string }) => {
    if (path === "/opportunities/manager/pipeline") {
      return {
        totalOpen: 3,
        pipelineValue: 90000,
        weightedValue: 45000,
        byOwner: [{ owner, openCount: 3, pipelineValue: 90000, weightedValue: 45000 }],
        byStage: [],
        aging: [{ bucket: "0-30 days", count: 3, value: 90000 }],
        highRiskDeals: [{ id: "o1", name: "Globex Renewal", owner, stage: null, amount: 50000, probability: 10, expectedCloseDate: null, ageDays: 80, risk: "high", riskReasons: ["Stalled in stage", "Low probability"] }],
        aiPlaceholder: { available: false, message: "x" }
      };
    }
    if (path === "/opportunities/manager/forecast") {
      return { categories: [{ category: { id: "c1", key: "commit", label: "Commit", description: null, color: null, isDefault: true, isActive: true }, count: 2, value: 60000 }], wonValue: 20000, openWeightedValue: 45000, aiPlaceholder: { available: false, message: "x" } };
    }
    if (path === "/opportunities/manager/performance") {
      return { reps: [{ owner, openCount: 3, wonCount: 4, lostCount: 1, winRate: 80, conversionRate: 50, avgDealSize: 30000, avgCycleDays: 21 }], aiPlaceholder: { available: false, message: "x" } };
    }
    if (path === "/sales-workspaces/manager/lead-sla") {
      return {
        assignedCount: 5,
        acceptedCount: 3,
        overdueFirstContactCount: 1,
        untouchedCount: 2,
        breachedCount: 1,
        leads: [{ id: "l1", fullName: "Jaya Lead", companyName: "Initech", owner, status: null, slaStatus: "breached", slaDueAt: null, untouched: true, accepted: false }]
      };
    }
    if (path === "/sales-workspaces/options") {
      return { owners: [owner] };
    }
    if (typeof path === "string" && path.startsWith("/approvals?")) {
      return { approvals: [{ id: "ap1", approvalType: "discount_approval", title: "20% discount on Globex", description: "Margin impact 5%", status: "pending", requestedBy: null, approverUser: null, approverRole: null, decidedBy: null, linkedRecord: null, latestComment: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), decidedAt: null }], pagination: {}, pendingCount: 1, availableTypes: [] };
    }
    return {};
  });
}

describe("SalesManagerDashboard", () => {
  beforeEach(() => apiRequestMock.mockReset());

  it("renders manager dashboards and decides a discount approval (SMGR-001/004)", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<SalesManagerDashboard accessToken="t" canManage />);

    expect(await screen.findByText("Team pipeline")).toBeInTheDocument();
    expect(screen.getByText("Globex Renewal · Asha Rep")).toBeInTheDocument();
    expect(screen.getByText("20% discount on Globex")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/approvals/ap1/decision",
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ decision: "approved" }) })
      )
    );
  });

  it("reassigns a breached lead with a reason (SMGR-002)", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<SalesManagerDashboard accessToken="t" canManage />);

    await screen.findByText("Lead SLA");
    await user.selectOptions(screen.getByRole("combobox"), "u1");
    await user.type(screen.getByPlaceholderText("Reason"), "Owner on leave");
    await user.click(screen.getByRole("button", { name: "Reassign" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/sales-workspaces/leads/l1/reassign",
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ ownerId: "u1", reason: "Owner on leave" }) })
      )
    );
  });
});
