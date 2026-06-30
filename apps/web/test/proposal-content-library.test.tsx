import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { ProposalContentLibrary } from "@/components/presales/proposal-content-library";

const category = { id: "c1", key: "case_study", label: "Case Study", description: null, color: null, isDefault: false, isActive: true };

describe("ProposalContentLibrary", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/proposals/options") return { owners: [], templates: [], statuses: [], contentCategories: [category], responseStatuses: [], complianceStatuses: [] };
      if (path === "/proposals/content-library") return { entries: [{ id: "e1", category, title: "Globex case study", body: "...", status: "approved", tags: [], expiresAt: "2020-01-01", expired: true, updatedBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
      return {};
    });
  });

  it("lists content, flags expired, and creates a new entry (PB-004)", async () => {
    const user = userEvent.setup();
    render(<ProposalContentLibrary accessToken="t" canManage />);

    expect(await screen.findByText("Proposal content library")).toBeInTheDocument();
    expect(screen.getByText("Globex case study", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("expired")).toBeInTheDocument();

    await user.selectOptions(screen.getAllByRole("combobox")[0], "case_study");
    await user.type(screen.getByPlaceholderText("Title"), "Security overview");
    await user.type(screen.getByPlaceholderText("Body"), "Our security posture");
    await user.click(screen.getByRole("button", { name: "Add content" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/proposals/content-library", expect.objectContaining({ method: "POST", body: expect.objectContaining({ title: "Security overview", categoryKey: "case_study" }) }))
    );
  });
});
