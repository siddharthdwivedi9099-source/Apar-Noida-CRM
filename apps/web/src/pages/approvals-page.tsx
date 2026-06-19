import { useEffect, useState } from "react";
import type {
  AddApprovalCommentRequestBody,
  ApprovalDecisionRequestBody,
  ApprovalListQuery,
  ApprovalType,
  ApprovalResponse,
  ApprovalsResponse
} from "@crm/types";
import { BadgeCheck, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { buildQueryString, formatDateTime, selectClassName, textareaClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useNavigate, useParams } from "react-router-dom";

const defaultQuery: ApprovalListQuery = {
  page: 1,
  pageSize: 20,
  status: "all",
  scope: "assigned"
};

function toTitleCaseLabel(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getLinkedRecordHref(input: { entityType: string; entityId: string } | null) {
  if (!input) {
    return null;
  }

  switch (input.entityType) {
    case "lead":
      return `/leads/${input.entityId}`;
    case "account":
      return `/accounts/${input.entityId}`;
    case "contact":
      return `/contacts/${input.entityId}`;
    case "campaign":
      return `/campaigns/${input.entityId}`;
    case "opportunity":
      return `/opportunities/${input.entityId}`;
    default:
      return null;
  }
}

function getApprovalBadgeVariant(status: string) {
  if (status === "approved") {
    return "success" as const;
  }

  if (status === "pending") {
    return "default" as const;
  }

  return "muted" as const;
}

export function ApprovalsPage() {
  const { approvalId } = useParams();
  const navigate = useNavigate();
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const approvalsLabel = getModuleLabel("approvals");
  const approvalLabel = getModuleLabel("approvals", "singular");
  const [query, setQuery] = useState<ApprovalListQuery>(defaultQuery);
  const [statusFilter, setStatusFilter] = useState<NonNullable<ApprovalListQuery["status"]>>("all");
  const [scopeFilter, setScopeFilter] = useState<NonNullable<ApprovalListQuery["scope"]>>("assigned");
  const [typeFilter, setTypeFilter] = useState<ApprovalType | "">("");
  const [searchFilter, setSearchFilter] = useState("");
  const [approvalsResponse, setApprovalsResponse] = useState<ApprovalsResponse | null>(null);
  const [approvalResponse, setApprovalResponse] = useState<ApprovalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [decisionComment, setDecisionComment] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canDecide = hasAnyPermission(["approvals.approve", "approvals.configure", "admin.configure"]);
  const canComment = hasAnyPermission([
    "approvals.view",
    "approvals.edit",
    "approvals.approve",
    "approvals.configure"
  ]);

  async function loadList(activeQuery: ApprovalListQuery) {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<ApprovalsResponse>(`/approvals${buildQueryString(activeQuery)}`, {
        method: "GET",
        accessToken
      });
      setApprovalsResponse(response);

      if (!approvalId && response.approvals[0]) {
        navigate(`/approvals/${response.approvals[0].id}`, { replace: true });
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDetail(currentApprovalId: string) {
    if (!accessToken) {
      return;
    }

    setIsDetailLoading(true);

    try {
      const response = await apiRequest<ApprovalResponse>(`/approvals/${currentApprovalId}`, {
        method: "GET",
        accessToken
      });
      setApprovalResponse(response);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadList(query);
  }, [accessToken, query]);

  useEffect(() => {
    if (!approvalId) {
      setApprovalResponse(null);
      return;
    }

    void loadDetail(approvalId);
  }, [accessToken, approvalId]);

  function applyFilters() {
    setQuery({
      page: 1,
      pageSize: 20,
      status: statusFilter,
      scope: scopeFilter,
      approvalType: typeFilter || undefined,
      search: searchFilter.trim() || undefined
    });
  }

  async function handleDecision(decision: ApprovalDecisionRequestBody["decision"]) {
    if (!accessToken || !approvalId) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest<ApprovalResponse>(`/approvals/${approvalId}/decision`, {
        method: "POST",
        accessToken,
        body: {
          decision,
          comment: decisionComment.trim() || undefined
        } satisfies ApprovalDecisionRequestBody
      });
      setDecisionComment("");
      setSuccessMessage(`${approvalLabel} ${decision}.`);
      await Promise.all([loadList(query), loadDetail(approvalId)]);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddComment() {
    if (!accessToken || !approvalId || !commentDraft.trim()) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest<ApprovalResponse>(`/approvals/${approvalId}/comments`, {
        method: "POST",
        accessToken,
        body: {
          comment: commentDraft.trim()
        } satisfies AddApprovalCommentRequestBody
      });
      setCommentDraft("");
      setSuccessMessage("Approval comment added.");
      await Promise.all([loadList(query), loadDetail(approvalId)]);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading && !approvalsResponse) {
    return (
      <CrmLoadingState
        title={`Loading ${approvalsLabel.toLowerCase()}`}
        description="The approval inbox is loading assigned decisions, status filters, and linked request history."
      />
    );
  }

  const selectedApproval = approvalResponse?.approval ?? null;
  const linkedRecordHref = getLinkedRecordHref(selectedApproval?.linkedRecord ?? null);

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Approval inbox"
        title={`${approvalsLabel} now track approvers, decision history, linked records, and in-app governance notifications from one tenant-safe workspace.`}
        summary="This inbox lets authorized users review pending work, inspect decision history, comment on requests, and approve or reject governed workflows without leaving the application shell."
        actions={
          <Button variant="outline" onClick={applyFilters}>
            Refresh
          </Button>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Pending"
              value={String(approvalsResponse?.pendingCount ?? 0)}
              description="Approval requests currently awaiting action from your assignment or role queue."
            />
            <CrmMetricCard
              label="Visible"
              value={String(approvalsResponse?.pagination.total ?? 0)}
              description="Approval requests visible under your current tenant scope and permissions."
            />
          </div>
        }
      />

      {errorMessage ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {successMessage ? (
        <Card>
          <CardContent className="p-6 text-sm text-emerald-700 dark:text-emerald-300">{successMessage}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Focus your inbox by status, scope, type, or search term before opening a specific request.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-medium">Status</span>
            <select
              className={selectClassName}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as NonNullable<ApprovalListQuery["status"]>)}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Scope</span>
            <select
              className={selectClassName}
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as NonNullable<ApprovalListQuery["scope"]>)}
            >
              <option value="assigned">Assigned to me</option>
              <option value="requested">Requested by me</option>
              <option value="all">All visible</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Type</span>
            <select
              className={selectClassName}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as ApprovalType | "")}
            >
              <option value="">All approval types</option>
              {approvalsResponse?.availableTypes.map((typeDefinition) => (
                <option key={typeDefinition.key} value={typeDefinition.key}>
                  {typeDefinition.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Search</span>
            <input
              className={selectClassName}
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="Search by title or description"
            />
          </label>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inbox list</CardTitle>
            <CardDescription>
              Pending requests stay at the top so approvers can work their queue quickly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {approvalsResponse && approvalsResponse.approvals.length === 0 ? (
              <CrmEmptyState
                title={`No ${approvalsLabel.toLowerCase()} match this filter`}
                description="Adjust the scope, status, or type to inspect other approval requests."
              />
            ) : (
              approvalsResponse?.approvals.map((approval) => (
                <Link
                  key={approval.id}
                  to={`/approvals/${approval.id}`}
                  className={`block rounded-[1.4rem] border p-5 shadow-sm transition ${
                    approval.id === selectedApproval?.id
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/70 bg-background/70 hover:bg-background/85"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getApprovalBadgeVariant(approval.status)}>{approval.status}</Badge>
                    <Badge variant="muted">
                      {approvalsResponse?.availableTypes.find((typeDefinition) => typeDefinition.key === approval.approvalType)?.label ??
                        toTitleCaseLabel(approval.approvalType)}
                    </Badge>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold">{approval.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {approval.description ?? "No description provided."}
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[1.1rem] bg-background/80 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Requested by</p>
                      <p className="mt-2 text-sm font-medium">
                        {approval.requestedBy?.displayName ?? "System"}
                      </p>
                    </div>
                    <div className="rounded-[1.1rem] bg-background/80 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Approver</p>
                      <p className="mt-2 text-sm font-medium">
                        {approval.approverUser?.displayName ?? approval.approverRole?.name ?? "Unassigned"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detail</CardTitle>
            <CardDescription>
              Review approval history, linked record context, and decision comments before acting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isDetailLoading ? (
              <CrmLoadingState
                title={`Loading ${approvalLabel.toLowerCase()} detail`}
                description="History, approver state, and linked record context are loading."
              />
            ) : !selectedApproval ? (
              <CrmEmptyState
                title={`Select an ${approvalLabel.toLowerCase()}`}
                description="Choose a request from the inbox to view its full history and decision controls."
              />
            ) : (
              <>
                <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/70 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getApprovalBadgeVariant(selectedApproval.status)}>
                      {selectedApproval.status}
                    </Badge>
                    <Badge variant="muted">
                      {approvalsResponse?.availableTypes.find((typeDefinition) => typeDefinition.key === selectedApproval.approvalType)?.label ??
                        toTitleCaseLabel(selectedApproval.approvalType)}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-semibold">{selectedApproval.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {selectedApproval.description ?? "No description provided."}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.15rem] bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Requested by</p>
                      <p className="mt-2 font-medium">
                        {selectedApproval.requestedBy?.displayName ?? "System"}
                      </p>
                    </div>
                    <div className="rounded-[1.15rem] bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Approver</p>
                      <p className="mt-2 font-medium">
                        {selectedApproval.approverUser?.displayName ??
                          selectedApproval.approverRole?.name ??
                          "Unassigned"}
                      </p>
                    </div>
                    <div className="rounded-[1.15rem] bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                      <p className="mt-2 font-medium">{formatDateTime(selectedApproval.createdAt)}</p>
                    </div>
                    <div className="rounded-[1.15rem] bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Decision</p>
                      <p className="mt-2 font-medium">
                        {selectedApproval.decidedAt
                          ? `${selectedApproval.decidedBy?.displayName ?? "Approver"} · ${formatDateTime(selectedApproval.decidedAt)}`
                          : "Pending decision"}
                      </p>
                    </div>
                    <div className="rounded-[1.15rem] bg-background/80 p-4 md:col-span-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Linked record</p>
                      {selectedApproval.linkedRecord ? (
                        linkedRecordHref ? (
                          <Link className="mt-2 inline-flex font-medium text-primary" to={linkedRecordHref}>
                            {toTitleCaseLabel(selectedApproval.linkedRecord.entityType)} ·{" "}
                            {selectedApproval.linkedRecord.entityId.slice(0, 8)}
                          </Link>
                        ) : (
                          <p className="mt-2 font-medium">
                            {toTitleCaseLabel(selectedApproval.linkedRecord.entityType)} ·{" "}
                            {selectedApproval.linkedRecord.entityId.slice(0, 8)}
                          </p>
                        )
                      ) : (
                        <p className="mt-2 font-medium text-muted-foreground">Not linked to a record.</p>
                      )}
                    </div>
                  </div>
                </div>

                {canDecide && selectedApproval.status === "pending" ? (
                  <Card className="rounded-[1.5rem]">
                    <CardHeader>
                      <CardTitle>Decision</CardTitle>
                      <CardDescription>
                        Add optional context, then approve or reject this request.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <textarea
                        className={textareaClassName}
                        value={decisionComment}
                        onChange={(event) => setDecisionComment(event.target.value)}
                        placeholder="Add approval or rejection context"
                      />
                      <div className="flex flex-wrap gap-3">
                        <Button disabled={isSaving} onClick={() => void handleDecision("approved")}>
                          <Check className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          disabled={isSaving}
                          onClick={() => void handleDecision("rejected")}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {canComment ? (
                  <Card className="rounded-[1.5rem]">
                    <CardHeader>
                      <CardTitle>Comments</CardTitle>
                      <CardDescription>
                        Add reviewer context without changing the current approval state.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <textarea
                        className={textareaClassName}
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                        placeholder="Add a note to the approval history"
                      />
                      <Button
                        variant="outline"
                        disabled={isSaving || !commentDraft.trim()}
                        onClick={() => void handleAddComment()}
                      >
                        <BadgeCheck className="mr-2 h-4 w-4" />
                        Add comment
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                <div className="space-y-4">
                  <div>
                    <h4 className="font-display text-xl font-semibold">History</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Every create, comment, and decision is stored chronologically for auditability.
                    </p>
                  </div>
                  {selectedApproval.history.map((historyEntry) => (
                    <div
                      key={historyEntry.id}
                      className="rounded-[1.35rem] border border-border/70 bg-background/70 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getApprovalBadgeVariant(historyEntry.toStatus ?? "pending")}>
                          {historyEntry.action}
                        </Badge>
                        {historyEntry.toStatus ? (
                          <Badge variant="muted">{historyEntry.toStatus}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm font-medium">
                        {historyEntry.actor?.displayName ?? "System"} · {formatDateTime(historyEntry.createdAt)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {historyEntry.comment ?? "No comment captured for this step."}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
