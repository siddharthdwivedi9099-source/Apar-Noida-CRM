import { useState } from "react";
import type { CrmTimelineFilterKind, CrmTimelineItem } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDateTime,
  getCrmActivityTypeLabel,
  getCrmTaskPriorityLabel,
  getCrmTaskStatusLabel,
  getCrmTimelineKindLabel
} from "@/lib/crm";

interface CrmTimelineProps {
  entityLabel: string;
  items: CrmTimelineItem[];
}

export function CrmTimeline({ entityLabel, items }: CrmTimelineProps) {
  const [activeKind, setActiveKind] = useState<CrmTimelineFilterKind>("all");

  const availableKinds = ["all", ...Array.from(new Set(items.map((item) => item.kind)))] as CrmTimelineFilterKind[];
  const filteredItems = items.filter((item) => activeKind === "all" || item.kind === activeKind);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer timeline</CardTitle>
        <CardDescription>
          View the chronological touchpoint history for this {entityLabel.toLowerCase()} and filter by event type.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {availableKinds.map((kind) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant={activeKind === kind ? "default" : "outline"}
              onClick={() => setActiveKind(kind)}
            >
              {getCrmTimelineKindLabel(kind)}
            </Button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            No timeline items match the selected filter yet.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="rounded-[1.25rem] border border-border/70 bg-background/70 p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{getCrmTimelineKindLabel(item.kind)}</Badge>
                  {item.activityType ? <Badge>{getCrmActivityTypeLabel(item.activityType)}</Badge> : null}
                  {item.taskStatus ? <Badge variant="muted">{getCrmTaskStatusLabel(item.taskStatus)}</Badge> : null}
                  {item.taskPriority ? <Badge variant="muted">{getCrmTaskPriorityLabel(item.taskPriority)}</Badge> : null}
                  {item.isCustomerFacing ? <Badge variant="success">Customer-facing</Badge> : null}
                  <p className="font-semibold">{item.title}</p>
                </div>
                {item.description ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <span>{formatDateTime(item.occurredAt)}</span>
                  <span>Actor {item.actor?.displayName ?? "System"}</span>
                  <span>Owner {item.owner?.displayName ?? "Unassigned"}</span>
                  {item.dueAt ? <span>Due {formatDateTime(item.dueAt)}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
