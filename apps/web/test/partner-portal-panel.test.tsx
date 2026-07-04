import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { PartnerPortalPanel } from "@/components/partners/partner-portal-panel";

const partner = { id: "pt1", name: "Acme Reseller", status: null, tier: null };
const deal = {
  id: "d1", partnerId: "pt1", partnerName: "Acme Reseller", name: "Globex deal", customerName: "Globex", contact: null, product: "Platform", amount: 50000,
  stage: { id: "s1", key: "approved", label: "Approved", description: null, color: null, isDefault: false, isActive: true }, expectedCloseDate: null, notes: null, documents: [],
  submissionStatus: "Approved", decisionNote: "Looks good", protectionUntil: null, collaboration: [], commission: { status: "eligible", amount: null, payoutApproved: false }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
};

describe("PartnerPortalPanel", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/partner-portal/session") return { session: { user: { id: "u1", displayName: "Reseller", email: "r@x.com", teamName: null, departmentName: null }, partners: [partner], dealCount: 1 } };
      if (path === "/partner-portal/deals" || path === undefined) return { deals: [deal] };
      if (path === "/partner-portal/commission") return { rows: [{ dealId: "d1", name: "Globex deal", customerName: "Globex", amount: 50000, commissionStatus: "eligible", commissionAmount: null, payoutApproved: false, closed: false, query: null }] };
      return {};
    });
  });

  it("shows scoped session + deals and registers a new deal (RS-001/002)", async () => {
    const user = userEvent.setup();
    render(<PartnerPortalPanel accessToken="t" canManage />);

    expect(await screen.findByText("Partner portal (reseller view)")).toBeInTheDocument();
    expect(screen.getByText(/Scoped to Acme Reseller/)).toBeInTheDocument();
    expect(screen.getByText("Globex deal", { exact: false })).toBeInTheDocument();

    await user.selectOptions(screen.getAllByRole("combobox")[0], "pt1");
    await user.type(screen.getByPlaceholderText("Deal name"), "New Initech deal");
    await user.click(screen.getByRole("button", { name: "Register deal" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/partner-portal/deals", expect.objectContaining({ method: "POST", body: expect.objectContaining({ partnerId: "pt1", name: "New Initech deal" }) }))
    );
  });

  it("sends a demo-request collaboration (RS-003)", async () => {
    const user = userEvent.setup();
    render(<PartnerPortalPanel accessToken="t" canManage />);

    await screen.findByText("My deals");
    await user.type(screen.getByPlaceholderText("Message"), "Need a demo for Globex");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/partner-portal/deals/d1/collaboration", expect.objectContaining({ method: "POST", body: expect.objectContaining({ content: "Need a demo for Globex" }) }))
    );
  });

  it("hides itself when the user has no portal access", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/partner-portal/session") throw new Error("You do not have partner portal access.");
      return {};
    });
    const { container } = render(<PartnerPortalPanel accessToken="t" canManage />);
    await waitFor(() => expect(container.querySelector("div")).toBeNull());
  });
});
