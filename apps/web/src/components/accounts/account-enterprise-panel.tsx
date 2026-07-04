import { useEffect, useState } from "react";
import type { AccountEnterpriseResponse, CrmLookupUserSummary } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface AccountEnterprisePanelProps {
  accountId: string;
  accessToken: string | null;
  canEdit: boolean;
  owners: CrmLookupUserSummary[];
}

const PLAN_FIELDS: [string, string][] = [
  ["accountOverview", "Account overview"],
  ["businessUnits", "Business units"],
  ["stakeholders", "Stakeholders"],
  ["systems", "Systems"],
  ["painPoints", "Pain points"],
  ["opportunities", "Opportunities"],
  ["competitors", "Competitors"],
  ["risks", "Risks"],
  ["actionPlan", "Action plan"]
];

export function AccountEnterprisePanel({ accountId, accessToken, canEdit, owners }: AccountEnterprisePanelProps) {
  const [data, setData] = useState<AccountEnterpriseResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [plan, setPlan] = useState<Record<string, string>>({});
  const [revenuePotential, setRevenuePotential] = useState("");
  const [reviewerUserId, setReviewerUserId] = useState("");
  const [meeting, setMeeting] = useState({ contactName: "", notes: "", commitments: "", followUps: "" });

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const response = await apiRequest<AccountEnterpriseResponse>(`/accounts/${accountId}/enterprise`, { method: "GET", accessToken });
      setData(response);
      const sp = response.enterprise.strategicPlan;
      setPlan({
        accountOverview: sp.accountOverview ?? "",
        businessUnits: sp.businessUnits ?? "",
        stakeholders: sp.stakeholders ?? "",
        systems: sp.systems ?? "",
        painPoints: sp.painPoints ?? "",
        opportunities: sp.opportunities ?? "",
        competitors: sp.competitors ?? "",
        risks: sp.risks ?? "",
        actionPlan: sp.actionPlan ?? ""
      });
      setRevenuePotential(sp.revenuePotential != null ? String(sp.revenuePotential) : "");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, accessToken]);

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken) {
      return;
    }
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      await load();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return null;
  }

  const engagement = data.enterprise.executiveEngagement;
  const plan_ = data.enterprise.strategicPlan;

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Strategic account plan</CardTitle>
          <CardDescription>
            Review: <Badge variant={plan_.reviewStatus === "reviewed" ? "success" : "muted"}>{plan_.reviewStatus}</Badge>{" "}
            {data.enterprise.whitespacePlaceholder.message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PLAN_FIELDS.map(([key, label]) => (
            <label key={key} className="space-y-1">
              <span className="text-sm font-medium">{label}</span>
              <textarea className={textareaClassName} rows={2} value={plan[key] ?? ""} onChange={(event) => setPlan((c) => ({ ...c, [key]: event.target.value }))} disabled={!canEdit || busy !== null} />
            </label>
          ))}
          <label className="space-y-1">
            <span className="text-sm font-medium">Revenue potential</span>
            <Input type="number" min={0} value={revenuePotential} onChange={(event) => setRevenuePotential(event.target.value)} disabled={!canEdit || busy !== null} />
          </label>
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-2">
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    "plan",
                    () =>
                      apiRequest(`/accounts/${accountId}/strategic-plan`, {
                        method: "POST",
                        accessToken,
                        body: { ...Object.fromEntries(PLAN_FIELDS.map(([key]) => [key, plan[key] || null])), revenuePotential: revenuePotential ? Number(revenuePotential) : null }
                      }),
                    "Strategic plan saved."
                  )
                }
              >
                Save plan
              </Button>
              <label className="space-y-1">
                <span className="text-sm font-medium">Reviewer</span>
                <select className={selectClassName} value={reviewerUserId} onChange={(event) => setReviewerUserId(event.target.value)} disabled={busy !== null}>
                  <option value="">Select…</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null || reviewerUserId.length === 0}
                onClick={() => void run("review", () => apiRequest(`/accounts/${accountId}/strategic-plan/review`, { method: "POST", accessToken, body: { reviewerUserId } }), "Sent for review.")}
              >
                Submit for review
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Executive engagement</CardTitle>
          <CardDescription>
            Score {engagement.score} · <Badge variant={engagement.band === "high" ? "success" : "muted"}>{engagement.band}</Badge> ·{" "}
            {engagement.meetingCount} meetings · {engagement.commitmentCount} commitments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {engagement.meetings.length > 0 ? (
            <div className="space-y-2">
              {engagement.meetings.map((m) => (
                <div key={m.id} className="rounded-[1rem] bg-background/75 p-3 text-sm">
                  <p className="font-medium">{m.contactName}</p>
                  {m.notes ? <p className="mt-1 text-muted-foreground">{m.notes}</p> : null}
                  {m.commitments ? <p className="mt-1">Commitments: {m.commitments}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No executive meetings logged.</p>
          )}
          {canEdit ? (
            <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-3">
              <Input placeholder="CXO contact name" value={meeting.contactName} onChange={(event) => setMeeting((c) => ({ ...c, contactName: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Notes" value={meeting.notes} onChange={(event) => setMeeting((c) => ({ ...c, notes: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Commitments" value={meeting.commitments} onChange={(event) => setMeeting((c) => ({ ...c, commitments: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Follow-ups" value={meeting.followUps} onChange={(event) => setMeeting((c) => ({ ...c, followUps: event.target.value }))} disabled={busy !== null} />
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null || meeting.contactName.trim().length === 0}
                onClick={() =>
                  void run(
                    "meeting",
                    async () => {
                      await apiRequest(`/accounts/${accountId}/executive-meeting`, { method: "POST", accessToken, body: { contactName: meeting.contactName.trim(), notes: meeting.notes || null, commitments: meeting.commitments || null, followUps: meeting.followUps || null } });
                      setMeeting({ contactName: "", notes: "", commitments: "", followUps: "" });
                    },
                    "Executive meeting logged."
                  )
                }
              >
                Log executive meeting
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
