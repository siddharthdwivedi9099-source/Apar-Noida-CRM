import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { SolutionArchitecturePanel } from "@/components/opportunities/solution-architecture-panel";

function buildView() {
  const dimensions = Object.fromEntries(
    ["scopeAmbiguity", "integrationComplexity", "timelineRisk", "customization", "dataMigration", "security", "compliance", "resourceAvailability"].map((key) => [key, { level: "low", note: null }])
  );
  const discovery = Object.fromEntries(["systems", "integrations", "apis", "authentication", "dataMigration", "hosting", "security", "compliance", "users", "concurrency", "reporting", "customWorkflows"].map((key) => [key, null]));
  return {
    architecture: {
      opportunityId: "opp-1",
      technicalDiscovery: { ...discovery, updatedAt: null },
      technicalDiscoveryStatus: { missingFields: ["systems"], capturedCount: 0, totalCount: 12, complete: false },
      architecture: { frontend: null, backend: null, database: null, integrations: null, aiLayer: null, analytics: null, security: null, deployment: null, support: null, status: "draft", approvedBy: null, approvedAt: null, linkedToProposal: false, updatedAt: null },
      integrations: [],
      securityVersions: [],
      deliveryRisk: { dimensions, summary: { overall: "low", highCount: 0, mediumCount: 0, requiresLeadershipApproval: false }, status: "open", approvalId: null, updatedAt: null },
      aiPlaceholders: { available: false, message: "x" }
    }
  };
}

describe("SolutionArchitecturePanel", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === "GET" || !init) {
        return buildView();
      }
      return buildView();
    });
  });

  it("renders sections and saves technical discovery (SA-001)", async () => {
    const user = userEvent.setup();
    render(<SolutionArchitecturePanel opportunityId="opp-1" accessToken="t" canManage />);

    expect(await screen.findByText("Technical discovery")).toBeInTheDocument();
    expect(screen.getByText("Architecture recommendation")).toBeInTheDocument();
    expect(screen.getByText("Delivery risk")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save discovery" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/solution-architecture/opp-1/technical-discovery", expect.objectContaining({ method: "PUT" }))
    );
  });

  it("adds an integration (SA-003) and submits delivery risk (SA-005)", async () => {
    const user = userEvent.setup();
    render(<SolutionArchitecturePanel opportunityId="opp-1" accessToken="t" canManage />);

    await screen.findByText("Integration assessments");
    await user.type(screen.getByPlaceholderText("System"), "SAP ERP");
    await user.click(screen.getByRole("button", { name: "Add integration" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/solution-architecture/opp-1/integrations", expect.objectContaining({ method: "POST", body: expect.objectContaining({ system: "SAP ERP" }) }))
    );

    await user.click(screen.getByRole("button", { name: "Submit for closure" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/solution-architecture/opp-1/delivery-risk/submit", expect.objectContaining({ method: "POST" }))
    );
  });
});
