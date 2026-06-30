import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { PartnerManagementPanel } from "@/components/partners/partner-management-panel";

function buildManagement() {
  return {
    management: {
      partnerId: "p1",
      partnerName: "Acme",
      application: { companyDetails: null, geography: null, industryFocus: null, salesCapacity: null, salesCapacityRating: 4, technicalCapability: null, technicalCapabilityRating: 3, customerBase: null, customerBaseSize: 50, certifications: "ISO", references: null, status: "applied", decisionNote: null, decidedBy: null, decidedAt: null, updatedAt: null },
      fitScore: { score: 70, band: "high" },
      onboarding: { items: [{ id: "o1", label: "Agreement executed", status: "pending", dueDate: "2026-07-10" }], totalCount: 1, completedCount: 0, percentComplete: 0 },
      aiPlaceholders: { available: false, message: "x" }
    }
  };
}

describe("PartnerManagementPanel", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/partners/p1/management") return buildManagement();
      if (path === "/partners/p1/deals") return { deals: [{ id: "d1", partnerId: "p1", name: "Globex deal", customerName: "Globex", stage: { id: "s1", key: "registered", label: "Registered", description: null, color: null, isDefault: true, isActive: true }, amount: 50000, expectedCloseDate: null, notes: null, opportunity: null, account: null, leadId: null, metadata: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
      return {};
    });
  });

  it("shows fit score + onboarding and approves the partner (PM-001)", async () => {
    const user = userEvent.setup();
    render(<PartnerManagementPanel partnerId="p1" accessToken="t" canManage />);

    expect(await screen.findByText("Partner application")).toBeInTheDocument();
    expect(screen.getByText(/fit score 70 \(high\)/)).toBeInTheDocument();
    expect(screen.getByText("Agreement executed", { exact: false })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/partners/p1/application/decision", expect.objectContaining({ method: "POST", body: expect.objectContaining({ decision: "approved" }) }))
    );
  });

  it("decides a partner deal registration (PM-003)", async () => {
    const user = userEvent.setup();
    render(<PartnerManagementPanel partnerId="p1" accessToken="t" canManage />);

    await screen.findByText("Deal registrations");
    expect(screen.getByText("Globex deal", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clarify" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/partners/p1/deals/d1/decision", expect.objectContaining({ method: "POST", body: expect.objectContaining({ decision: "clarification" }) }))
    );
  });
});
