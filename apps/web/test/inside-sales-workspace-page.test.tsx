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
  useTenantConfig: () => ({
    getModuleLabel: () => "Lead"
  })
}));

vi.mock("@/lib/api-client", () => ({
  apiRequest: apiRequestMock,
  ApiClientError: class ApiClientError extends Error {}
}));

import { InsideSalesWorkspacePage } from "@/pages/inside-sales-workspace-page";

function optionValue(key: string, label: string, isDefault = false) {
  return { id: `opt-${key}`, key, label, description: null, color: null, isDefault, isActive: true };
}

function buildOptions() {
  return {
    owners: [{ id: "u1", displayName: "Asha Rep", email: "asha@example.com", teamName: null, departmentName: null }],
    leadStatuses: [optionValue("new", "New", true), optionValue("qualified", "Qualified"), optionValue("disqualified", "Disqualified")],
    leadSources: [optionValue("website", "Website", true)],
    outreachStatuses: [optionValue("not_started", "Not started", true), optionValue("nurture", "Nurture")],
    handoffStatuses: [optionValue("not_started", "Not started", true)],
    callDispositions: [optionValue("pending", "Pending", true), optionValue("interested", "Interested")],
    qualificationFrameworks: [{ key: "bant", label: "BANT", description: "", available: true }],
    disqualificationReasons: [optionValue("future_need", "Future Need"), optionValue("spam", "Spam")],
    qualificationChecklistItems: [
      { key: "need", label: "Need identified", description: null, required: true, sortOrder: 0 },
      { key: "budget_range", label: "Budget range", description: null, required: true, sortOrder: 1 }
    ],
    qualificationOutcomes: [optionValue("pending", "Pending", true), optionValue("qualified", "Qualified")],
    cadenceSteps: [
      { key: "call_day0", label: "Day 0 - Call", channel: "call", offsetHours: 0, order: 0 },
      { key: "email_day1", label: "Day 1 - Email", channel: "email", offsetHours: 24, order: 1 }
    ],
    meetingTypes: [
      { key: "sales", label: "Sales meeting" },
      { key: "presales", label: "Presales / technical" }
    ]
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
    score: 90,
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
      qualificationItems: [
        { key: "need", label: "Need identified", required: true, completed: false },
        { key: "budget_range", label: "Budget range", required: true, completed: false }
      ],
      qualificationItemsCompletionCount: 0,
      qualificationItemsTotal: 2,
      qualificationItemsRequiredCount: 2,
      qualificationItemsRequiredComplete: false,
      qualificationOutcome: "pending" as const,
      qualificationOverrideReason: null,
      disqualificationReason: null,
      cadence: {
        configured: true,
        paused: false,
        pauseReason: null,
        steps: [
          { key: "call_day0", label: "Day 0 - Call", channel: "call" as const, offsetHours: 0, order: 0, completed: false, dueAt: "2026-06-28T08:00:00.000Z", status: "overdue" as const },
          { key: "email_day1", label: "Day 1 - Email", channel: "email" as const, offsetHours: 24, order: 1, completed: false, dueAt: "2026-06-29T08:00:00.000Z", status: "upcoming" as const }
        ],
        currentStep: { key: "call_day0", label: "Day 0 - Call", channel: "call" as const, offsetHours: 0, order: 0, completed: false, dueAt: "2026-06-28T08:00:00.000Z", status: "overdue" as const },
        nextDueAt: "2026-06-28T08:00:00.000Z",
        completedCount: 0,
        totalCount: 2,
        failedAttemptCount: 0,
        failedAttemptsBeforeNurture: 3,
        movedToNurture: false
      },
      handoffUpdatedAt: null,
      meddicPlaceholder: { available: false as const, message: "n/a" },
      emailSequencePlaceholder: { available: false as const, message: "n/a" },
      meetingBookingPlaceholder: { available: false as const, message: "n/a" }
    },
    openTaskCount: 0,
    openCallTaskCount: 0,
    overdueTaskCount: 0,
    nextOpenTaskDueAt: null,
    priority: "hot" as const,
    isHot: true,
    scoreGrade: "A",
    productSummary: "Education Platform",
    slaDueAt: "2026-06-28T12:00:00.000Z",
    slaStatus: "breached" as const,
    slaLabel: "First response",
    slaRemainingHours: -2,
    slaBreachAlert: true,
    firstContactScript: {
      key: "inbound_website",
      label: "Inbound website lead",
      body: "Thank them for reaching out through the website.",
      matchedOn: "source" as const
    }
  };
}

function buildWorkspace() {
  return {
    dashboard: {
      leadQueueCount: 1,
      callQueueCount: 0,
      followUpTaskCount: 0,
      qualifiedLeadCount: 0,
      handedOffLeadCount: 0,
      completedCallCount: 0
    },
    leadQueue: [buildLead()],
    callQueue: [],
    followUpTasks: [],
    aiPlaceholders: { actions: [], governanceHint: "hidden" }
  };
}

describe("Inside sales workspace", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  function mockApi() {
    apiRequestMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === "/sales-workspaces/options") {
        return buildOptions();
      }
      if (path === "/sales-workspaces/inside-sales") {
        return buildWorkspace();
      }
      if (path.startsWith("/sales-workspaces/leads/") && path.endsWith("/meetings") && init?.method === "POST") {
        return {
          lead: buildLead(),
          meeting: {
            activityId: "act-1",
            meetingTaskId: "task-1",
            reminderTaskId: "task-2",
            deliveryPlaceholder: { available: false, message: "deferred" }
          }
        };
      }
      if (path.startsWith("/sales-workspaces/leads/") && init?.method === "PATCH") {
        return { lead: buildLead() };
      }
      throw new Error(`Unexpected request: ${path} (${init?.method ?? "GET"})`);
    });
  }

  it("surfaces ISR-001 queue enrichment and the ISR-002 first-contact script", async () => {
    mockApi();
    render(
      <MemoryRouter>
        <InsideSalesWorkspacePage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Ravi Kumar")).length).toBeGreaterThan(0);
    // Hot priority + product surfaced in the queue (ISR-001).
    expect(screen.getAllByText(/🔥 Hot/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Education Platform/)).toBeInTheDocument();
    // Resolved first-contact script body is shown (ISR-002).
    expect(screen.getByText("Thank them for reaching out through the website.")).toBeInTheDocument();
  });

  it("submits ISR-004/006 workflow fields when saving", async () => {
    mockApi();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <InsideSalesWorkspacePage />
      </MemoryRouter>
    );

    await screen.findAllByText("Ravi Kumar");
    await user.click(screen.getByRole("button", { name: "Save workflow" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/sales-workspaces/leads/lead-1/workflow",
        expect.objectContaining({
          method: "PATCH",
          body: expect.objectContaining({
            qualificationOutcome: "pending",
            qualificationItems: expect.objectContaining({ need: false, budget_range: false })
          })
        })
      )
    );
  });

  it("renders the ISR-003 cadence + SLA-breach alert and books an ISR-005 meeting", async () => {
    mockApi();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <InsideSalesWorkspacePage />
      </MemoryRouter>
    );

    await screen.findAllByText("Ravi Kumar");
    // ISR-003 cadence steps + ISR-001 SLA breach alert are rendered.
    expect(screen.getByText("Day 0 - Call")).toBeInTheDocument();
    expect(screen.getAllByText(/SLA breach/i).length).toBeGreaterThan(0);

    // ISR-005: book a meeting.
    await user.type(screen.getByPlaceholderText("Discovery call"), "Kickoff");
    await user.type(screen.getByLabelText("When"), "2026-07-01T10:00");
    await user.click(screen.getByRole("button", { name: "Book meeting" }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/sales-workspaces/leads/lead-1/meetings",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({ meetingTypeKey: "sales", title: "Kickoff" })
        })
      )
    );
  });
});
