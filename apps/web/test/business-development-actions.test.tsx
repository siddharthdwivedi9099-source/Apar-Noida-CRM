import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { BusinessDevelopmentActions } from "@/components/business-development/business-development-actions";

function option(key: string, label: string, isDefault = false) {
  return { id: `opt-${key}`, key, label, description: null, color: null, isDefault, isActive: true };
}

function buildOptions() {
  return {
    owners: [{ id: "u1", displayName: "Asha Rep", email: "asha@example.com", teamName: null, departmentName: null }],
    accounts: [],
    contacts: [],
    tiers: [option("strategic", "Strategic", true)],
    stages: [option("identified", "Identified", true)],
    partnershipTypes: [],
    availableScopes: ["all", "mine", "team"],
    priorities: [option("high", "High")],
    technologies: [option("aws", "AWS")],
    buyerRoles: [option("decision_maker", "Decision Maker"), option("technical", "Technical")],
    sequenceSteps: [],
    opportunityStages: [option("discovery", "Discovery", true), option("proposal", "Proposal")]
  };
}

function buildDetail() {
  return {
    id: "bd-1",
    name: "Globex",
    account: { id: "acc-1", name: "Globex", website: null },
    owner: { id: "u1", displayName: "Asha Rep", email: "asha@example.com", teamName: null, departmentName: null },
    tier: option("strategic", "Strategic", true),
    stage: option("identified", "Identified", true),
    partnershipType: null,
    industry: "SaaS",
    region: "IN",
    annualRevenue: null,
    employeeCount: null,
    marketOpportunityNotes: null,
    executiveSponsor: null,
    nextStep: null,
    isPartnership: false,
    stakeholderCount: 1,
    executiveStakeholderCount: 0,
    priority: option("high", "High"),
    technologies: [option("aws", "AWS")],
    engagement: {
      score: 45,
      band: "warming" as const,
      buyingSignal: false,
      signals: { opens: 5, clicks: 2, websiteVisits: 1, eventAttendance: 0, replies: 1, meetings: 0, stakeholderEngagement: 1 }
    },
    metadata: {},
    createdAt: "2026-06-28T08:00:00.000Z",
    updatedAt: "2026-06-28T08:00:00.000Z",
    stakeholders: [
      {
        id: "sh-1",
        name: "Riya Decision",
        title: "VP",
        contact: null,
        influenceLevel: "high" as const,
        relationshipStrength: "engaged" as const,
        isExecutive: true,
        buyerRole: null,
        lastEngagementAt: null,
        engagementNotes: null,
        createdAt: "2026-06-28T08:00:00.000Z",
        updatedAt: "2026-06-28T08:00:00.000Z"
      }
    ],
    buyingCommittee: {
      score: 0,
      total: 2,
      covered: 0,
      roles: [
        { key: "decision_maker", label: "Decision Maker", covered: false },
        { key: "technical", label: "Technical", covered: false }
      ],
      missingRoles: [
        { key: "decision_maker", label: "Decision Maker", covered: false },
        { key: "technical", label: "Technical", covered: false }
      ]
    },
    sequence: {
      configured: true,
      paused: false,
      pauseReason: null,
      steps: [
        { key: "email_day0", label: "Day 0 email", channel: "email" as const, offsetHours: 0, order: 0, persona: null, product: null, region: null, completed: false, dueAt: "2026-06-28T08:00:00.000Z", status: "overdue" as const }
      ],
      currentStep: { key: "email_day0", label: "Day 0 email", channel: "email" as const, offsetHours: 0, order: 0, persona: null, product: null, region: null, completed: false, dueAt: "2026-06-28T08:00:00.000Z", status: "overdue" as const },
      nextDueAt: "2026-06-28T08:00:00.000Z",
      completedCount: 0,
      totalCount: 1
    },
    handoff: null,
    territoryPlaceholder: { available: false as const, message: "n/a" },
    aiPlaceholders: { actions: [], governanceHint: "hidden" }
  };
}

describe("BusinessDevelopmentActions", () => {
  beforeEach(() => apiRequestMock.mockReset());

  it("renders engagement, committee, and sequence and saves engagement signals (BDR-004)", async () => {
    apiRequestMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <BusinessDevelopmentActions
        detail={buildDetail() as never}
        options={buildOptions() as never}
        accessToken="test-token"
        canUpdate
        onReload={vi.fn()}
      />
    );

    expect(screen.getByText("Account engagement")).toBeInTheDocument();
    expect(screen.getByText(/Coverage 0\/2/)).toBeInTheDocument();
    expect(screen.getByText("Day 0 email")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save engagement" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/business-development/bd-1",
        expect.objectContaining({ method: "PATCH", body: expect.objectContaining({ engagementSignals: expect.any(Object) }) })
      )
    );
  });

  it("submits a strategic handoff with manager approval (BDR-005)", async () => {
    apiRequestMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <BusinessDevelopmentActions
        detail={buildDetail() as never}
        options={buildOptions() as never}
        accessToken="test-token"
        canUpdate
        onReload={vi.fn()}
      />
    );

    const ownerSelects = screen.getAllByRole("combobox");
    // The handoff "Sales owner" select is the one with the "Select owner…" option.
    const salesOwnerSelect = ownerSelects.find((select) => select.innerHTML.includes("Select owner")) as HTMLSelectElement;
    await user.selectOptions(salesOwnerSelect, "u1");
    const approachField = screen.getByText("Recommended approach").parentElement?.querySelector("textarea") as HTMLTextAreaElement;
    await user.type(approachField, "Engage CFO with ROI model");
    await user.click(screen.getByRole("button", { name: "Hand off to sales" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/business-development/bd-1/handoff",
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ salesOwnerId: "u1" }) })
      )
    );
  });
});
