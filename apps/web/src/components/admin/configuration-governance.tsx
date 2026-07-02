import { useEffect, useState } from "react";
import type { ConfigurationVersionSummary } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface ConfigurationGovernanceProps {
  accessToken: string | null;
}

/**
 * SH-005 process governance: RevOps proposes a configuration change (draft from current
 * config), submits it for Sales Head review, and the Sales Head approves (publishes/versions)
 * or rejects. Reuses the configuration versioning + approvals engines.
 */
export function ConfigurationGovernance({ accessToken }: ConfigurationGovernanceProps) {
  const [versions, setVersions] = useState<ConfigurationVersionSummary[]>([]);
  const [reason, setReason] = useState("");
  const [approverByVersion, setApproverByVersion] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const result = await apiRequest<{ versions: ConfigurationVersionSummary[] }>("/configuration/versions", { method: "GET", accessToken });
      setVersions(result.versions);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

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

  const drafts = versions.filter((version) => version.status === "draft");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales process governance</CardTitle>
        <CardDescription>Propose, review, and version sales-process changes (SH-005).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

        <div className="flex flex-wrap items-end gap-2 rounded-[1rem] border border-border/60 p-3">
          <Input placeholder="Change reason (required)" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy !== null} />
          <Button
            type="button"
            disabled={busy !== null || reason.trim().length < 3}
            onClick={() => void run("propose", async () => {
              await apiRequest("/configuration/versions", { method: "POST", accessToken, body: { changeReason: reason.trim() } });
              setReason("");
            }, "Draft change proposed from current configuration.")}
          >
            Propose change
          </Button>
        </div>

        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No draft process changes awaiting governance.</p>
        ) : (
          drafts.slice(0, 6).map((version) => (
            <div key={version.id} className="rounded-[1rem] bg-background/75 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">Version #{version.versionNumber}</span>
                <Badge variant="muted">{version.status}</Badge>
              </div>
              {version.changeReason ? <p className="mt-1 text-xs text-muted-foreground">{version.changeReason}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground">Created {formatDateTime(version.createdAt)}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <Input
                  placeholder="Approver user id"
                  value={approverByVersion[version.id] ?? ""}
                  onChange={(event) => setApproverByVersion((c) => ({ ...c, [version.id]: event.target.value }))}
                  disabled={busy !== null}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null || !(approverByVersion[version.id] ?? "").trim()}
                  onClick={() => void run(`submit-${version.id}`, () => apiRequest(`/configuration/versions/${version.id}/submit-review`, { method: "POST", accessToken, body: { approverUserId: approverByVersion[version.id].trim(), changeSummary: version.changeReason } }), "Submitted for Sales Head review.")}
                >
                  Submit for review
                </Button>
                <Button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void run(`approve-${version.id}`, () => apiRequest(`/configuration/versions/${version.id}/review-decision`, { method: "POST", accessToken, body: { decision: "approved" } }), "Approved and published.")}
                >
                  Approve &amp; publish
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => void run(`reject-${version.id}`, () => apiRequest(`/configuration/versions/${version.id}/review-decision`, { method: "POST", accessToken, body: { decision: "rejected" } }), "Change rejected.")}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
