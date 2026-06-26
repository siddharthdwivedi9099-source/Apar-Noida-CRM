import { useCallback, useEffect, useState } from "react";
import type { BpfHistoryResponse, BpfStateView } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

interface BpfStageProgressProps {
  object: string;
  recordId: string;
  canEdit: boolean;
  record?: Record<string, unknown>;
}

function slaLabel(view: BpfStateView): { text: string; variant: "default" | "muted" | "success" } | null {
  switch (view.aging.slaStatus) {
    case "breached":
      return { text: "SLA breached", variant: "default" };
    case "warning":
      return { text: "SLA warning", variant: "default" };
    case "ok":
      return { text: "Within SLA", variant: "success" };
    default:
      return null;
  }
}

export function BpfStageProgress({ object, recordId, canEdit, record }: BpfStageProgressProps) {
  const { accessToken } = useAuth();
  const [view, setView] = useState<BpfStateView | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTo, setSelectedTo] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<BpfHistoryResponse["history"] | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    try {
      const data = await apiRequest<BpfStateView>(`/bpf/${object}/${recordId}/state`, { accessToken });
      setView(data);
      setUnavailable(false);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError && (err.statusCode === 404 || err.statusCode === 403)) {
        setUnavailable(true);
        return;
      }
      setError(getErrorMessage(err));
    }
  }, [accessToken, object, recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetTransitionForm() {
    setSelectedTo(null);
    setReason("");
    setOverride(false);
    setOverrideReason("");
  }

  async function submitTransition(toStage: string) {
    if (!accessToken) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiRequest<BpfStateView>(`/bpf/${object}/${recordId}/transition`, {
        method: "POST",
        accessToken,
        body: {
          toStage,
          reason: reason.trim() || undefined,
          isManagerOverride: override || undefined,
          overrideReason: overrideReason.trim() || undefined,
          record
        }
      });
      setView(updated);
      setHistory(null);
      resetTransitionForm();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function loadHistory() {
    if (!accessToken) {
      return;
    }
    try {
      const data = await apiRequest<BpfHistoryResponse>(`/bpf/${object}/${recordId}/history`, { accessToken });
      setHistory(data.history);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (unavailable || !view) {
    return null;
  }

  const sla = slaLabel(view);
  const currentStage = view.stages.find((stage) => stage.key === view.currentStage);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {view.bpfName}
          {sla ? <Badge variant={sla.variant}>{sla.text}</Badge> : null}
          {view.aging.aging ? <Badge variant="muted">Aging</Badge> : null}
        </CardTitle>
        <CardDescription>
          {view.initialized ? `Current stage: ${currentStage?.label ?? view.currentStage}` : "Not yet started in this flow"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {view.stages.map((stage) => (
            <Badge
              key={stage.key}
              variant={stage.status === "current" ? "default" : stage.status === "done" ? "success" : "muted"}
              className={cn(stage.status === "upcoming" && "opacity-60", stage.isTerminal && "italic")}
            >
              {stage.label}
            </Badge>
          ))}
        </div>

        {canEdit && view.allowedNextStages.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Move to</p>
            <div className="flex flex-wrap gap-2">
              {view.allowedNextStages.map((next) => {
                const stage = view.stages.find((entry) => entry.key === next);
                return (
                  <Button
                    key={next}
                    type="button"
                    size="sm"
                    variant={selectedTo === next ? "default" : "outline"}
                    onClick={() => setSelectedTo(next)}
                  >
                    {stage?.label ?? next}
                  </Button>
                );
              })}
            </div>

            {selectedTo ? (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <textarea
                  className="w-full rounded-md border border-border bg-transparent p-2 text-sm"
                  placeholder="Reason (required for backward movement)"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={override} onChange={(event) => setOverride(event.target.checked)} />
                  Manager override
                </label>
                {override ? (
                  <input
                    className="w-full rounded-md border border-border bg-transparent p-2 text-sm"
                    placeholder="Override reason (required)"
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                  />
                ) : null}
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={submitting} onClick={() => void submitTransition(selectedTo)}>
                    {submitting ? "Moving…" : "Confirm move"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={resetTransitionForm}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div>
          <Button type="button" size="sm" variant="ghost" onClick={() => (history ? setHistory(null) : void loadHistory())}>
            {history ? "Hide history" : "Show stage history"}
          </Button>
          {history ? (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {history.length === 0 ? <li>No stage changes yet.</li> : null}
              {history.map((entry, index) => (
                <li key={index}>
                  {entry.fromStage ?? "—"} → {entry.toStage}
                  {entry.isBackward ? " (backward)" : ""}
                  {entry.isOverride ? " (override)" : ""}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
