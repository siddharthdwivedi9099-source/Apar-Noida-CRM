import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { PresalesDeliveryPanels } from "@/components/presales/presales-delivery-panels";

const owner = { id: "u1", displayName: "Arch Itect", email: "arch@example.com", teamName: null, departmentName: null };

function buildDetail() {
  return {
    id: "req-1",
    title: "Globex demo",
    type: null,
    status: null,
    priority: "high",
    opportunity: { id: "opp-1", name: "Globex", stage: null },
    account: null,
    owner,
    assignee: owner,
    dueDate: null,
    summary: null,
    product: null,
    triageStatus: null,
    requirementCount: 1,
    metRequirementCount: 0,
    gapRequirementCount: 1,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    technicalRequirements: null,
    proposalContent: null,
    triage: null,
    demoWorkspace: null,
    demoFeedback: null,
    fitmentReview: null,
    poc: null,
    requirements: [
      { id: "rq-1", label: "SSO integration", category: "integration", requirement: null, response: null, complianceStatus: "gap", priority: "high", sortOrder: 0, customization: null, integration: null, dependency: null, risk: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ],
    demoCalendarPlaceholder: { available: false, message: "x" },
    solutionRepositoryPlaceholder: { available: false, message: "x" },
    aiPlaceholders: { available: false } as never
  };
}

function buildOptions() {
  return {
    owners: [owner],
    accounts: [],
    opportunities: [],
    requestTypes: [],
    statuses: [],
    priorities: ["low", "medium", "high", "urgent"],
    demoChecklistItems: [{ id: "c1", key: "environment_ready", label: "Demo environment ready", description: null, color: null, isDefault: true, isActive: true }],
    availableScopes: ["all"]
  };
}

describe("PresalesDeliveryPanels", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({});
  });

  it("triages a request (PS-001) and saves the demo workspace (PS-002)", async () => {
    const user = userEvent.setup();
    render(<PresalesDeliveryPanels detail={buildDetail() as never} options={buildOptions() as never} accessToken="t" canEdit onReload={() => {}} />);

    expect(screen.getByText("Request triage")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/presales/req-1/triage", expect.objectContaining({ method: "POST", body: expect.objectContaining({ action: "accepted" }) }))
    );

    await user.click(screen.getByRole("button", { name: "Save demo workspace" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/presales/req-1/demo-workspace", expect.objectContaining({ method: "POST" }))
    );
  });

  it("turns a gap requirement into a task (PS-004) and signs off the POC (PS-005)", async () => {
    const user = userEvent.setup();
    render(<PresalesDeliveryPanels detail={buildDetail() as never} options={buildOptions() as never} accessToken="t" canEdit onReload={() => {}} />);

    expect(screen.getByText("SSO integration")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "To task" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/presales/req-1/fitment/gap-task", expect.objectContaining({ method: "POST", body: expect.objectContaining({ requirementId: "rq-1" }) }))
    );

    await user.click(screen.getByRole("button", { name: "Sign off" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/presales/req-1/poc/sign-off", expect.objectContaining({ method: "POST", body: expect.objectContaining({ outcome: "success" }) }))
    );
  });
});
