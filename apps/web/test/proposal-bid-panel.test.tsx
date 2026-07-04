import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { ProposalBidPanel } from "@/components/opportunities/proposal-bid-panel";

const owner = { id: "u1", displayName: "Bid Mgr", email: "bid@example.com", teamName: null, departmentName: null };

function buildWorkspace() {
  return {
    proposal: {
      opportunityId: "opp-1",
      initialized: true,
      status: { id: "s1", key: "draft", label: "Draft", description: null, color: null, isDefault: true, isActive: true },
      template: null,
      scope: null,
      dueDate: null,
      contributors: [],
      complianceItems: [{ id: "ci-1", requirement: "Data residency", owner: null, responseStatus: "pending", complianceStatus: "pending", comments: null, evidence: null, response: null }],
      complianceSummary: { total: 1, respondedCount: 0, missingResponseCount: 1, compliantCount: 0, gapCount: 0, complete: false },
      versions: [{ id: "v1", label: "v1", notes: null, fileRef: null, createdBy: owner, createdAt: new Date().toISOString(), locked: false, isFinal: false }],
      versionSummary: { count: 1, hasFinal: false, finalLocked: false },
      finalVersionId: null,
      approvalId: null,
      approvalStatus: null,
      submission: null,
      updatedAt: null,
      aiPlaceholders: { available: false, message: "x" }
    }
  };
}

function buildOptions() {
  return { owners: [owner], templates: [], statuses: [{ id: "s1", key: "draft", label: "Draft", description: null, color: null, isDefault: true, isActive: true }], contentCategories: [], responseStatuses: ["pending", "in_progress", "complete"], complianceStatuses: ["pending", "compliant", "partial", "non_compliant", "not_applicable"] };
}

describe("ProposalBidPanel", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/proposals/options") return buildOptions();
      return buildWorkspace();
    });
  });

  it("renders sections and adds a compliance requirement (PB-002)", async () => {
    const user = userEvent.setup();
    render(<ProposalBidPanel opportunityId="opp-1" accessToken="t" canManage />);

    expect(await screen.findByText("RFP compliance matrix")).toBeInTheDocument();
    expect(screen.getByText("Data residency", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Version control")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Requirement"), "Encryption at rest");
    await user.click(screen.getByRole("button", { name: "Add requirement" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/proposals/opp-1/compliance", expect.objectContaining({ method: "POST", body: expect.objectContaining({ requirement: "Encryption at rest" }) }))
    );
  });

  it("records a submission (PB-005)", async () => {
    const user = userEvent.setup();
    render(<ProposalBidPanel opportunityId="opp-1" accessToken="t" canManage />);

    await screen.findByText("Submission tracking");
    await user.type(screen.getByLabelText("Submitted at"), "2026-07-01");
    await user.type(screen.getByPlaceholderText("Mode (email/portal/courier)"), "portal");
    await user.click(screen.getByRole("button", { name: "Record submission" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/proposals/opp-1/submission", expect.objectContaining({ method: "POST", body: expect.objectContaining({ mode: "portal" }) }))
    );
  });
});
