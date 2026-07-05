import { useState } from "react";
import type { CampaignClosureReport, CampaignDetail, CampaignOutcome, CrmLookupUserSummary } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const outcomeOptions: Array<{ value: CampaignOutcome; label: string }> = [
  { value: "successful", label: "Successful" },
  { value: "partially_successful", label: "Partially successful" },
  { value: "unsuccessful", label: "Unsuccessful" }
];

/**
 * CM-004 + CM-005: campaign go-live approval (budget/type policy enforced
 * server-side) and campaign closure with a deterministic performance report.
 */
export function CampaignGovernancePanel({
  campaign,
  owners,
  onChanged
}: {
  campaign: CampaignDetail;
  owners: CrmLookupUserSummary[];
  onChanged: () => Promise<void> | void;
}) {
  const { accessToken, hasAnyPermission } = useAuth();
  const [approverUserId, setApproverUserId] = useState("");
  const [outcome, setOutcome] = useState<CampaignOutcome>("successful");
  const [learnings, setLearnings] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!hasAnyPermission(["campaigns.edit", "campaigns.assign", "campaigns.approve", "campaigns.configure"])) {
    return null;
  }

  const approvalState = (campaign.metadata.approval ?? null) as { approvalId?: string; status?: string } | null;
  const closureReport = (campaign.metadata.closureReport ?? null) as CampaignClosureReport | null;

  async function run(path: string, body: Record<string, unknown>, successMessage: string) {
    if (!accessToken) {
      return;
    }
    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      await apiRequest(path, { method: "POST", accessToken, body });
      setMessage(successMessage);
      await onChanged();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign governance</CardTitle>
        <CardDescription>
          Go-live approval is policy-driven (budget threshold + campaign type are tenant configuration); closure captures a
          performance report with learnings so the next campaign starts smarter.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3 rounded-[1.25rem] bg-background/75 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Go-live approval</p>
            {approvalState?.status ? <Badge variant="muted">{approvalState.status}</Badge> : <Badge variant="muted">not requested</Badge>}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Campaigns at or above the configured budget threshold cannot move to Active until approved.
          </p>
          <label className="space-y-2">
            <span className="text-sm font-medium">Approver</span>
            <select className={selectClassName} value={approverUserId} onChange={(event) => setApproverUserId(event.target.value)}>
              <option value="">Select approver</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.displayName}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            disabled={isWorking || !approverUserId}
            onClick={() => void run(`/campaigns/${campaign.id}/approval-request`, { approverUserId }, "Approval requested.")}
          >
            Request approval
          </Button>
        </div>

        <div className="space-y-3 rounded-[1.25rem] bg-background/75 p-5">
          <p className="font-semibold">Close campaign</p>
          {closureReport ? (
            <div className="space-y-2 text-sm leading-6">
              <div className="flex flex-wrap gap-2">
                <Badge>{closureReport.outcome.replace(/_/g, " ")}</Badge>
                <Badge variant="muted">{closureReport.metrics.leadCount} leads</Badge>
                <Badge variant="muted">{closureReport.metrics.mqlCount} MQLs</Badge>
                <Badge variant="muted">{closureReport.metrics.convertedLeadCount} converted</Badge>
              </div>
              <p className="text-muted-foreground">{closureReport.learnings ?? "No learnings captured."}</p>
            </div>
          ) : (
            <>
              <label className="space-y-2">
                <span className="text-sm font-medium">Outcome</span>
                <select
                  className={selectClassName}
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value as CampaignOutcome)}
                >
                  {outcomeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Learnings</span>
                <textarea className={textareaClassName} rows={2} value={learnings} onChange={(event) => setLearnings(event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Recommendations</span>
                <textarea
                  className={textareaClassName}
                  rows={2}
                  value={recommendations}
                  onChange={(event) => setRecommendations(event.target.value)}
                />
              </label>
              <Button
                size="sm"
                variant="outline"
                disabled={isWorking}
                onClick={() =>
                  void run(
                    `/campaigns/${campaign.id}/close`,
                    { outcome, learnings: learnings || null, recommendations: recommendations || null },
                    "Campaign closed with a performance report."
                  )
                }
              >
                Close with report
              </Button>
            </>
          )}
        </div>

        {(message || errorMessage) && (
          <div className="lg:col-span-2">
            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
