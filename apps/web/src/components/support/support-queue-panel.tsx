import { useEffect, useState } from "react";
import type { SupportQueueResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface SupportQueuePanelProps {
  accessToken: string | null;
  onSelect?: (ticketId: string) => void;
}

export function SupportQueuePanel({ accessToken, onSelect }: SupportQueuePanelProps) {
  const [queue, setQueue] = useState<SupportQueueResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    apiRequest<SupportQueueResponse>("/support/queue", { method: "GET", accessToken })
      .then(setQueue)
      .catch((error) => setErrorMessage(getErrorMessage(error)));
  }, [accessToken]);

  if (!queue) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA queue</CardTitle>
        <CardDescription>Sorted by SLA urgency · {queue.breachedCount} breached · {queue.atRiskCount} at risk (L1-002).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
        {queue.entries.length === 0 ? <p className="text-sm text-muted-foreground">Queue is clear.</p> : queue.entries.slice(0, 20).map((entry) => (
          <button key={entry.ticketId} type="button" onClick={() => onSelect?.(entry.ticketId)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-background/75 p-2 text-left text-sm transition hover:bg-secondary/60">
            <span>{entry.subject} · {entry.customerName ?? "—"}</span>
            <span className="flex items-center gap-2">
              {entry.priority ? <Badge variant="muted">{entry.priority.label}</Badge> : null}
              <Badge variant={entry.slaRisk === "breached" ? "default" : "muted"}>SLA {entry.slaRisk}</Badge>
              {entry.breachAlert ? <Badge variant="default">breach alert</Badge> : null}
              <span className="text-xs text-muted-foreground">{entry.slaDueAt ? formatDateTime(entry.slaDueAt) : "no SLA"}</span>
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
