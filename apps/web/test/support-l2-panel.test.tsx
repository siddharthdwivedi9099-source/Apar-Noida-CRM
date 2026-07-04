import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { SupportL2Panel } from "@/components/support/support-l2-panel";

const owner = { id: "u1", displayName: "Eng Lead", email: "eng@example.com", teamName: null, departmentName: null };

function buildOptions() {
  return { owners: [owner], accounts: [], contacts: [], statuses: [], priorities: [], categories: [], sources: [], knowledgeCategories: [], rootCauses: [], slaPolicies: [], availableScopes: ["all"], fieldDefinitions: [], customFieldOptions: {} };
}

function buildInvestigation() {
  return {
    investigation: {
      ticketId: "t1", subject: "Integration failing", slaStatus: null, slaDueAt: null,
      environment: null, configuration: null, logs: null, attachments: ["log1.txt"],
      notes: [], priorTickets: [{ ticketId: "t0", subject: "Earlier sync issue", status: { id: "s1", key: "closed", label: "Closed", description: null, color: null, isDefault: false, isActive: true }, createdAt: new Date().toISOString() }],
      bugEscalation: null, rca: null, rcaRequired: true, aiPlaceholder: { available: false, message: "x" }
    }
  };
}

describe("SupportL2Panel", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.endsWith("/investigation")) return buildInvestigation();
      return {};
    });
  });

  it("shows prior tickets + RCA-required and escalates a bug (L2-001/002)", async () => {
    const user = userEvent.setup();
    render(<SupportL2Panel ticketId="t1" options={buildOptions() as never} accessToken="t" canManage />);

    expect(await screen.findByText("Technical investigation")).toBeInTheDocument();
    expect(screen.getByText("Earlier sync issue", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/RCA required \(critical incident\)/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Steps to reproduce"), "Call the sync endpoint twice");
    await user.click(screen.getByRole("button", { name: "Escalate bug" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/support/tickets/t1/bug-escalation", expect.objectContaining({ method: "POST", body: expect.objectContaining({ stepsToReproduce: "Call the sync endpoint twice" }) }))
    );
  });

  it("saves RCA and creates a draft knowledge article (L2-003/004)", async () => {
    const user = userEvent.setup();
    render(<SupportL2Panel ticketId="t1" options={buildOptions() as never} accessToken="t" canManage />);

    await screen.findByText("Root cause analysis");
    await user.type(screen.getByPlaceholderText("Root cause"), "Race condition in sync worker");
    await user.click(screen.getByRole("button", { name: "Save RCA" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/support/tickets/t1/rca", expect.objectContaining({ method: "PUT", body: expect.objectContaining({ rootCause: "Race condition in sync worker" }) }))
    );

    await user.click(screen.getByRole("button", { name: "Create draft article from ticket" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/support/tickets/t1/kb-article", expect.objectContaining({ method: "POST" }))
    );
  });
});
