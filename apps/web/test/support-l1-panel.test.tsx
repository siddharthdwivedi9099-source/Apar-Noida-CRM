import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { SupportL1Panel } from "@/components/support/support-l1-panel";

const owner = { id: "u1", displayName: "L2 Agent", email: "l2@example.com", teamName: null, departmentName: null };

function buildOptions() {
  return {
    owners: [owner], accounts: [], contacts: [], statuses: [], priorities: [], categories: [], sources: [], knowledgeCategories: [],
    rootCauses: [{ id: "rc1", key: "software_defect", label: "Software Defect", description: null, color: null, isDefault: false, isActive: true }],
    slaPolicies: [], availableScopes: ["all"], fieldDefinitions: [], customFieldOptions: {}
  };
}

describe("SupportL1Panel", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.endsWith("/intake-assist")) return { duplicates: [{ ticketId: "t2", subject: "Login broken", status: { id: "s1", key: "new", label: "New", description: null, color: null, isDefault: true, isActive: true }, createdAt: new Date().toISOString() }], classification: { categoryKey: "access", urgency: "urgent" }, aiPlaceholder: { available: false, message: "x" } };
      if (path.endsWith("/kb-recommendations")) return { recommendations: [{ articleId: "a1", title: "Reset password", category: null, score: 3 }], aiPlaceholder: { available: false, message: "x" } };
      return {};
    });
  });

  it("shows intake assist + KB recs and escalates to L2 (L1-001/003/004)", async () => {
    const user = userEvent.setup();
    render(<SupportL1Panel ticketId="t1" options={buildOptions() as never} accessToken="t" canManage onReload={() => {}} />);

    expect(await screen.findByText("Intake assist")).toBeInTheDocument();
    expect(screen.getByText("Login broken", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Reset password", { exact: false })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Escalation reason"), "Needs DB access");
    await user.click(screen.getByRole("button", { name: "Escalate" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/support/tickets/t1/escalate", expect.objectContaining({ method: "POST", body: expect.objectContaining({ reason: "Needs DB access" }) }))
    );
  });

  it("closes the ticket with a resolution summary (L1-005)", async () => {
    const user = userEvent.setup();
    render(<SupportL1Panel ticketId="t1" options={buildOptions() as never} accessToken="t" canManage onReload={() => {}} />);

    await screen.findByRole("button", { name: "Close ticket" });
    await user.type(screen.getByPlaceholderText("Resolution summary"), "Reset the password and confirmed access");
    await user.click(screen.getByRole("button", { name: "Close ticket" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/support/tickets/t1/close", expect.objectContaining({ method: "POST", body: expect.objectContaining({ resolutionSummary: "Reset the password and confirmed access" }) }))
    );
  });
});
