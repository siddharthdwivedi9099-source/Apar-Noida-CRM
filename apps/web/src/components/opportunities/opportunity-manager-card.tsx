import { useEffect, useState, type FormEvent } from "react";
import type { OpportunityDetail, OpportunityOptionsResponse } from "@crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface OpportunityManagerCardProps {
  detail: OpportunityDetail;
  options: OpportunityOptionsResponse;
  accessToken: string | null;
  canManage: boolean;
  onReload: () => Promise<void> | void;
}

export function OpportunityManagerCard({ detail, options, accessToken, canManage, onReload }: OpportunityManagerCardProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [review, setReview] = useState({ comments: "", risks: "", blockers: "", nextStep: "" });
  const [forecast, setForecast] = useState({ managerOverrideCategoryKey: "", overrideReason: "" });
  const [coaching, setCoaching] = useState({ assigneeUserId: "", title: "", description: "" });

  useEffect(() => {
    setMessage(null);
    setErrorMessage(null);
  }, [detail.id]);

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

  const call = (path: string, body: Record<string, unknown>) =>
    apiRequest(`/opportunities/${detail.id}${path}`, { method: "POST", accessToken, body });

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("review", () => call("/deal-review-log", { comments: review.comments.trim(), risks: review.risks || null, blockers: review.blockers || null, nextStep: review.nextStep || null }), "Deal review saved.");
    setReview({ comments: "", risks: "", blockers: "", nextStep: "" });
  }

  if (!canManage) {
    return null;
  }

  const reviews = detail.managerDealReviews ?? [];

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Manager deal review</CardTitle>
          <CardDescription>Coaching review with saved history (SMGR-003).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviews.length > 0 ? (
            <div className="space-y-2">
              {reviews.slice(-5).reverse().map((r) => (
                <div key={r.id} className="rounded-[1rem] bg-background/75 p-2 text-sm">
                  <p className="text-xs text-muted-foreground">{r.reviewedBy?.displayName ?? "Manager"} · {formatDateTime(r.createdAt)}</p>
                  <p className="mt-1">{r.comments}</p>
                  {r.risks ? <p className="mt-1 text-xs text-muted-foreground">Risks: {r.risks}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No deal reviews yet.</p>
          )}
          <form className="space-y-2" onSubmit={handleReview}>
            <textarea className={textareaClassName} rows={2} placeholder="Manager comments" value={review.comments} onChange={(event) => setReview((c) => ({ ...c, comments: event.target.value }))} disabled={busy !== null} />
            <div className="grid gap-2 md:grid-cols-2">
              <Input placeholder="Risks" value={review.risks} onChange={(event) => setReview((c) => ({ ...c, risks: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Blockers" value={review.blockers} onChange={(event) => setReview((c) => ({ ...c, blockers: event.target.value }))} disabled={busy !== null} />
            </div>
            <Input placeholder="Next step" value={review.nextStep} onChange={(event) => setReview((c) => ({ ...c, nextStep: event.target.value }))} disabled={busy !== null} />
            <Button type="submit" disabled={busy !== null || review.comments.trim().length === 0}>Save review</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Forecast override</CardTitle>
          <CardDescription>Adjust the rep forecast category with a reason (SMGR-005).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <select className={selectClassName} value={forecast.managerOverrideCategoryKey} onChange={(event) => setForecast((c) => ({ ...c, managerOverrideCategoryKey: event.target.value }))} disabled={busy !== null}>
            <option value="">Forecast category…</option>
            {(options.forecastCategories ?? []).map((cat) => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
          <Input placeholder="Override reason" value={forecast.overrideReason} onChange={(event) => setForecast((c) => ({ ...c, overrideReason: event.target.value }))} disabled={busy !== null} />
          <Button type="button" disabled={busy !== null || forecast.managerOverrideCategoryKey.length === 0} onClick={() => void run("forecast", () => call("/forecast", { managerOverrideCategoryKey: forecast.managerOverrideCategoryKey, overrideReason: forecast.overrideReason || null }), "Forecast updated.")}>
            Save forecast
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coaching task</CardTitle>
          <CardDescription>Assign a coaching action to a rep (SMGR-006).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <select className={selectClassName} value={coaching.assigneeUserId} onChange={(event) => setCoaching((c) => ({ ...c, assigneeUserId: event.target.value }))} disabled={busy !== null}>
            <option value="">Assign to rep…</option>
            {(options.owners ?? []).map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.displayName}</option>
            ))}
          </select>
          <Input placeholder="Coaching task title" value={coaching.title} onChange={(event) => setCoaching((c) => ({ ...c, title: event.target.value }))} disabled={busy !== null} />
          <Input placeholder="Description" value={coaching.description} onChange={(event) => setCoaching((c) => ({ ...c, description: event.target.value }))} disabled={busy !== null} />
          <Button type="button" disabled={busy !== null || coaching.assigneeUserId.length === 0 || coaching.title.trim().length < 2} onClick={() => void run("coaching", async () => {
            await call("/coaching-task", { assigneeUserId: coaching.assigneeUserId, title: coaching.title.trim(), description: coaching.description || null });
            setCoaching({ assigneeUserId: "", title: "", description: "" });
          }, "Coaching task created.")}>
            Create coaching task
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
