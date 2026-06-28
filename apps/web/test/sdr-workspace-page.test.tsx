import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn()
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["leads.view", "leads.edit", "leads.assign"] },
    session: { id: "s1" },
    accessToken: "test-token",
    isAuthenticated: true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    login: vi.fn(),
    logout: vi.fn(),
    reloadCurrentUser: vi.fn()
  })
}));

vi.mock("@/providers/tenant-config-provider", () => ({
  useTenantConfig: () => ({ getModuleLabel: () => "Lead" })
}));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { SdrWorkspacePage } from "@/pages/sdr-workspace-page";

function optionValue(key: string, label: string, isDefault = false) {
  return { id: `opt-${key}`, key, label, description: null, color: null, isDefault, isActive: true };
}

function buildOptions() {
  return {
    owners: [{ id: "u1", displayName: "Asha Rep", email: "asha@example.com", teamName: null, departmentName: null }],
    leadStatuses: [optionValue("new", "New", true), optionValue("qualified", "Qualified")],
    leadSources: [optionValue("website", "Website", true)],
    outreachStatuses: [optionValue("not_started", "Not started", true)],
    handoffStatuses: [optionValue("not_started", "Not started", true)],
    callDispositions: [optionValue("pending", "Pending", true)],
    qualificationFrameworks: [{ key: "bant", label: "BANT", description: "", available: true }],
    disqualificationReasons: [optionValue("spam", "Spam")],
    qualificationChecklistItems: [],
    qualificationOutcomes: [optionValue("pending", "Pending", true)],
    cadenceSteps: [],
    meetingTypes: [{ key: "sales", label: "Sales meeting" }],
    discoveryFields: [{ key: "pain", label: "Pain", description: null, required: true, sortOrder: 0 }],
    objectionTypes: [
      { key: "price", label: "Price" },
      { key: "timing", label: "Timing" }
    ],
    icpCriteria: [{ key: "industry", label: "Industry", weight: 1 }],
    opportunityStages: [optionValue("discovery", "Discovery", true)]
  };
}

function buildLead() {
  return {
    id: "lead-1",
    firstName: "Ravi",
    lastName: "Kumar",
    fullName: "Ravi Kumar",
    companyName: "Globex",
    email: "ravi@globex.test",
    phone: null,
    status: optionValue("new", "New", true),
    source: optionValue("website", "Website", true),
    score: 50,
    owner: { id: "u1", displayName: "Asha Rep", email: "asha@example.com", teamName: null, departmentName: null },
    noteCount: 0,
    activityCount: 0,
    lastActivityAt: null,
    metadata: {},
    createdAt: "2026-06-28T08:00:00.000Z",
    updatedAt: "2026-06-28T08:00:00.000Z",
    workspace: {
      outreachStatus: null,
      handoffStatus: null,
      callDisposition: null,
      qualificationFramework: "bant" as const,
      qualificationChecklist: { budget: false, authority: false, need: false, timeline: false },
      qualificationChecklistCompletionCount: 0,
      qualificationChecklistTotal: 4,
      customQualificationFields: [],
      qualificationNotes: null,
      qualificationItems: [],
      qualificationItemsCompletionCount: 0,
      qualificationItemsTotal: 0,
      qualificationItemsRequiredCount: 0,
      qualificationItemsRequiredComplete: true,
      qualificationOutcome: "pending" as const,
      qualificationOverrideReason: null,
      disqualificationReason: null,
      cadence: {
        configured: false,
        paused: false,
        pauseReason: null,
        steps: [],
        currentStep: null,
        nextDueAt: null,
        completedCount: 0,
        totalCount: 0,
        failedAttemptCount: 0,
        failedAttemptsBeforeNurture: 3,
        movedToNurture: false
      },
      research: {
        companyProfile: null,
        industry: null,
        size: null,
        leadership: null,
        locations: null,
        likelyNeeds: null,
        recentSignals: null,
        talkingPoints: null,
        sources: [],
        confidence: null,
        savedAt: null
      },
      icpFit: {
        configured: true,
        band: "high" as const,
        score: 100,
        explanation: [{ key: "industry", label: "Industry", satisfied: true, weight: 1, contribution: 1 }],
        attributes: {
          industry: "SaaS",
          segment: null,
          size: null,
          geography: null,
          useCase: null,
          budget: null,
          strategicValue: "high" as const
        }
      },
      discovery: {
        items: [{ key: "pain", label: "Pain", required: true, value: "", completed: false }],
        completionCount: 0,
        total: 1,
        requiredCount: 1,
        requiredComplete: false
      },
      objections: [
        { id: "obj-1", typeKey: "price", typeLabel: "Price", note: "Too expensive", capturedAt: "2026-06-28T09:00:00.000Z" }
      ],
      noShowCount: 0,
      handoffUpdatedAt: null,
      meddicPlaceholder: { available: false as const, message: "n/a" },
      emailSequencePlaceholder: { available: false as const, message: "n/a" },
      meetingBookingPlaceholder: { available: false as const, message: "n/a" }
    },
    openTaskCount: 0,
    openCallTaskCount: 0,
    overdueTaskCount: 0,
    nextOpenTaskDueAt: null,
    priority: "medium" as const,
    isHot: false,
    scoreGrade: null,
    productSummary: null,
    slaDueAt: null,
    slaStatus: null,
    slaLabel: null,
    slaRemainingHours: null,
    slaBreachAlert: false,
    firstContactScript: null
  };
}

function buildSdr() {
  return {
    dashboard: {
      assignedLeadCount: 1,
      prospectingLeadCount: 0,
      activeOutreachCount: 0,
      callTaskCount: 0,
      meetingBookedCount: 0,
      readyForHandoffCount: 0
    },
    assignedLeads: [buildLead()],
    prospectingQueue: [],
    callTaskList: [],
    icpFitDistribution: { high: 1, medium: 0, low: 0 },
    objectionTrends: [{ typeKey: "price", label: "Price", count: 1 }],
    aiPlaceholders: { actions: [], governanceHint: "hidden" }
  };
}

describe("SDR workspace", () => {
  beforeEach(() => apiRequestMock.mockReset());

  function mockApi() {
    apiRequestMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === "/sales-workspaces/options") return buildOptions();
      if (path === "/sales-workspaces/sdr") return buildSdr();
      if (typeof path === "string" && path.startsWith("/sales-workspaces/leads/") && init?.method === "PATCH") {
        return { lead: buildLead() };
      }
      return {};
    });
  }

  it("renders SDR-002 ICP distribution + SDR-006 objection trends and the captured objection", async () => {
    mockApi();
    render(
      <MemoryRouter>
        <SdrWorkspacePage />
      </MemoryRouter>
    );

    await screen.findAllByText("Ravi Kumar");
    expect(screen.getByText("ICP fit distribution")).toBeInTheDocument();
    expect(screen.getByText("Objection trends")).toBeInTheDocument();
    // High-fit badge from the ICP panel + the captured objection note.
    expect(screen.getAllByText(/HIGH fit/).length).toBeGreaterThan(0);
    expect(screen.getByText("Too expensive")).toBeInTheDocument();
  });

  it("captures an objection via the SDR panel (SDR-006)", async () => {
    mockApi();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SdrWorkspacePage />
      </MemoryRouter>
    );

    await screen.findAllByText("Ravi Kumar");
    await user.type(screen.getByPlaceholderText("Context (optional)"), "Wants discount");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/sales-workspaces/leads/lead-1/workflow",
        expect.objectContaining({
          method: "PATCH",
          body: expect.objectContaining({ addObjection: expect.objectContaining({ typeKey: "price" }) })
        })
      )
    );
  });
});
