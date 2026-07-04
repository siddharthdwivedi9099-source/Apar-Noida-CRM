import { useEffect, useState } from "react";
import type { PortalOnboardingResponse, PortalOnboardingTask } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

export function CustomerPortalOnboardingPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<PortalOnboardingResponse | null>(null);
  const [docRefs, setDocRefs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    try {
      setData(await apiRequest<PortalOnboardingResponse>("/customer-portal/onboarding", { accessToken }));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function complete(task: PortalOnboardingTask) {
    if (!accessToken) return;
    setBusy(task.id);
    setMessage(null);
    setErrorMessage(null);
    try {
      await apiRequest(`/customer-portal/onboarding/${task.id}/complete`, { method: "POST", accessToken, body: { documentRef: docRefs[task.id]?.trim() || null } });
      await load();
      setMessage("Task marked complete — your success manager has been notified.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding tasks</CardTitle>
        <CardDescription>{data?.planName ? `Plan: ${data.planName}` : "Your implementation tasks, due dates, owners and instructions."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {message ? <p className="text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="text-rose-600">{errorMessage}</p> : null}
        {!data || data.tasks.length === 0 ? (
          <p className="text-muted-foreground">No onboarding tasks assigned yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.tasks.map((task) => (
              <li key={task.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{task.label}</span>
                  <Badge variant={task.status === "completed" ? "success" : "muted"}>{task.status}</Badge>
                  {task.dueDate ? <span className="text-xs text-muted-foreground">due {task.dueDate}</span> : null}
                  {task.owner ? <span className="text-xs text-muted-foreground">owner {task.owner.displayName}</span> : null}
                </div>
                {task.instructions ? <p className="mt-1 text-xs text-muted-foreground">{task.instructions}</p> : null}
                {task.documents.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">Documents: {task.documents.join(", ")}</p> : null}
                {task.status !== "completed" ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <Input placeholder="Document link (optional)" className="w-64" value={docRefs[task.id] ?? ""} onChange={(e) => setDocRefs((c) => ({ ...c, [task.id]: e.target.value }))} disabled={busy !== null} />
                    <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void complete(task)}>Mark complete</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
