import { useEffect, useState } from "react";
import type { OpportunitiesResponse, OpportunityDetail, OpportunityOptionsResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface OpportunityEnterpriseActionsProps {
  detail: OpportunityDetail;
  options: OpportunityOptionsResponse;
  accessToken: string | null;
  canEdit: boolean;
  onReload: () => Promise<void> | void;
}

export function OpportunityEnterpriseActions({ detail, options, accessToken, canEdit, onReload }: OpportunityEnterpriseActionsProps) {
  const ent = detail.enterprise;
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<{ id: string; name: string }[]>([]);
  const [parentId, setParentId] = useState(ent.parentOpportunityId ?? "");
  const [tender, setTender] = useState({ tenderNumber: "", issuingAuthority: "", deadline: "", scope: "", emd: "" });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [review, setReview] = useState({ solutionFit: "", pricing: "", legal: "", risk: "", deliveryReadiness: "", leadershipSupport: "", approverUserId: "" });

  useEffect(() => {
    setParentId(ent.parentOpportunityId ?? "");
    setTender({
      tenderNumber: ent.tender?.tenderNumber ?? "",
      issuingAuthority: ent.tender?.issuingAuthority ?? "",
      deadline: ent.tender?.deadline ?? "",
      scope: ent.tender?.scope ?? "",
      emd: ent.tender?.emd ?? ""
    });
    setChecklist(Object.fromEntries((ent.tender?.checklistItems ?? []).map((item) => [item.key, item.completed])));
    setReview({
      solutionFit: ent.dealReview.solutionFit ?? "",
      pricing: ent.dealReview.pricing ?? "",
      legal: ent.dealReview.legal ?? "",
      risk: ent.dealReview.risk ?? "",
      deliveryReadiness: ent.dealReview.deliveryReadiness ?? "",
      leadershipSupport: ent.dealReview.leadershipSupport ?? "",
      approverUserId: ""
    });
    setMessage(null);
    setErrorMessage(null);
     
  }, [detail.id]);

  useEffect(() => {
    if (!accessToken || !detail.account?.id) {
      return;
    }
    apiRequest<OpportunitiesResponse>(`/opportunities?accountId=${detail.account.id}&pageSize=100`, { method: "GET", accessToken })
      .then((response) => setSiblings(response.opportunities.filter((opp) => opp.id !== detail.id).map((opp) => ({ id: opp.id, name: opp.name }))))
      .catch(() => setSiblings([]));
  }, [accessToken, detail.account?.id, detail.id]);

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken) {
      return;
    }
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      await onReload();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const call = (path: string, method: "POST" | "PATCH", body: Record<string, unknown>) =>
    apiRequest(`/opportunities/${detail.id}${path}`, { method, accessToken, body });

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Multi-opportunity roll-up</CardTitle>
          <CardDescription>
            {ent.rollup.childCount} child opportunities · roll-up {formatCurrencyAmount(ent.rollup.totalValue)} · weighted{" "}
            {formatCurrencyAmount(ent.rollup.weightedValue)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ent.parent ? <p className="text-sm text-muted-foreground">Parent: {ent.parent.name}</p> : null}
          {ent.children.length > 0 ? (
            <div className="space-y-2">
              {ent.children.map((child) => (
                <div key={child.id} className="flex items-center justify-between gap-2 rounded-[1rem] bg-background/75 px-3 py-2 text-sm">
                  <span>{child.name}</span>
                  <span className="flex items-center gap-2">
                    {child.stageLabel ? <Badge variant="muted">{child.stageLabel}</Badge> : null}
                    <span>{formatCurrencyAmount(child.amount ?? 0)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No child opportunities yet.</p>
          )}
          {canEdit && siblings.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 space-y-1">
                <span className="text-sm font-medium">Parent opportunity</span>
                <select className={selectClassName} value={parentId} onChange={(event) => setParentId(event.target.value)} disabled={busy !== null}>
                  <option value="">No parent</option>
                  {siblings.map((sibling) => (
                    <option key={sibling.id} value={sibling.id}>
                      {sibling.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("parent", () => call("/parent", "POST", { parentOpportunityId: parentId || null }), "Parent updated.")}>
                Save parent
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RFP / tender</CardTitle>
          <CardDescription>
            {ent.tender ? `${ent.tender.completionCount}/${ent.tender.total} docs` : "No tender tracked yet."}
            {ent.tender && ent.tender.missingDocuments.length > 0 ? ` • Missing: ${ent.tender.missingDocuments.join(", ")}` : ""}
          </CardDescription>
        </CardHeader>
        {canEdit ? (
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <Input placeholder="Tender number" value={tender.tenderNumber} onChange={(event) => setTender((c) => ({ ...c, tenderNumber: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Issuing authority" value={tender.issuingAuthority} onChange={(event) => setTender((c) => ({ ...c, issuingAuthority: event.target.value }))} disabled={busy !== null} />
              <Input type="date" value={tender.deadline} onChange={(event) => setTender((c) => ({ ...c, deadline: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="EMD" value={tender.emd} onChange={(event) => setTender((c) => ({ ...c, emd: event.target.value }))} disabled={busy !== null} />
            </div>
            <textarea className={textareaClassName} rows={2} placeholder="Scope" value={tender.scope} onChange={(event) => setTender((c) => ({ ...c, scope: event.target.value }))} disabled={busy !== null} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy !== null} onClick={() => void run("tender", () => call("/tender", "POST", { ...tender, tenderNumber: tender.tenderNumber || null, issuingAuthority: tender.issuingAuthority || null, deadline: tender.deadline || null, scope: tender.scope || null, emd: tender.emd || null }), "Tender saved.")}>
                Save tender
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("tenderTasks", () => call("/tender", "POST", { generateTasks: true }), "Tender tasks generated.")}>
                Generate function tasks
              </Button>
            </div>
            {ent.tender ? (
              <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-3">
                <p className="text-sm font-semibold">Checklist</p>
                {ent.tender.checklistItems.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checklist[item.key] ?? false}
                      onChange={(event) => setChecklist((c) => ({ ...c, [item.key]: event.target.checked }))}
                      disabled={busy !== null}
                    />
                    {item.label}
                    {item.required ? <span className="text-rose-600"> *</span> : null}
                  </label>
                ))}
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("checklist", () => call("/tender/checklist", "PATCH", { checklist }), "Checklist updated.")}>
                  Save checklist
                </Button>
              </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deal governance</CardTitle>
          <CardDescription>
            {ent.dealReviewRequired ? "Review required for this deal value" : "Review optional"} · status: {ent.dealReview.status}
            {ent.dealReviewRequired && !ent.dealReviewComplete ? " • blocks final negotiation" : ""}
          </CardDescription>
        </CardHeader>
        {canEdit ? (
          <CardContent className="space-y-2">
            {(
              [
                ["solutionFit", "Solution fit"],
                ["pricing", "Pricing"],
                ["legal", "Legal"],
                ["risk", "Risk"],
                ["deliveryReadiness", "Delivery readiness"],
                ["leadershipSupport", "Leadership support"]
              ] as [keyof typeof review, string][]
            ).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-sm font-medium">{label}</span>
                <Input value={review[key]} onChange={(event) => setReview((c) => ({ ...c, [key]: event.target.value }))} disabled={busy !== null} />
              </label>
            ))}
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <Button type="button" disabled={busy !== null} onClick={() => void run("review", () => call("/deal-review", "POST", { solutionFit: review.solutionFit || null, pricing: review.pricing || null, legal: review.legal || null, risk: review.risk || null, deliveryReadiness: review.deliveryReadiness || null, leadershipSupport: review.leadershipSupport || null }), "Deal review saved.")}>
                Save review
              </Button>
              <label className="space-y-1">
                <span className="text-sm font-medium">Approver</span>
                <select className={selectClassName} value={review.approverUserId} onChange={(event) => setReview((c) => ({ ...c, approverUserId: event.target.value }))} disabled={busy !== null}>
                  <option value="">Select…</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null || review.approverUserId.length === 0}
                onClick={() =>
                  void run(
                    "reviewSubmit",
                    () =>
                      call("/deal-review", "POST", {
                        solutionFit: review.solutionFit || null,
                        pricing: review.pricing || null,
                        legal: review.legal || null,
                        risk: review.risk || null,
                        deliveryReadiness: review.deliveryReadiness || null,
                        leadershipSupport: review.leadershipSupport || null,
                        submitForApproval: true,
                        approverUserId: review.approverUserId
                      }),
                    "Deal review submitted for approval."
                  )
                }
              >
                Submit for approval
              </Button>
            </div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
