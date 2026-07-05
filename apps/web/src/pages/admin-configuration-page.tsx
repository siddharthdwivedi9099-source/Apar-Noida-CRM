import { useEffect, useState } from "react";
import type { ConfigurationValidationResponse, ConfigurationVersion, ConfigurationVersionSummary } from "@crm/types";
import { Link } from "react-router-dom";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

// ADMIN-006: CRM Administrator configuration console — draft → validate → publish → rollback,
// every change carrying a reason, all backed by the existing configuration versioning engine.
export function AdminConfigurationPage() {
  const { accessToken } = useAuth();
  const [versions, setVersions] = useState<ConfigurationVersionSummary[]>([]);
  const [validation, setValidation] = useState<ConfigurationValidationResponse | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadVersions() {
    if (!accessToken) return;
    try {
      const result = await apiRequest<{ versions: ConfigurationVersionSummary[] }>("/configuration/versions", { method: "GET", accessToken });
      setVersions(result.versions);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadVersions();
     
  }, [accessToken]);

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken) return;
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      await loadVersions();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const drafts = versions.filter((v) => v.status === "draft");
  const published = versions.filter((v) => v.status === "published");

  return (
    <div className="space-y-6">
      <AdminNav />

      <Card>
        <CardHeader>
          <CardTitle>Configuration versioning</CardTitle>
          <CardDescription>Draft, validate, publish, and roll back tenant configuration. Every change requires a reason and is audit-logged (ADMIN-006).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

          <div className="flex flex-wrap items-end gap-2">
            <Input placeholder="Change reason (required)" className="w-72" value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy !== null} />
            <Button
              type="button"
              disabled={busy !== null || reason.trim().length < 3}
              onClick={() => void run("draft", async () => { await apiRequest("/configuration/versions", { method: "POST", accessToken, body: { changeReason: reason.trim() } }); setReason(""); }, "Draft created from current configuration.")}
            >
              Create draft
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void run("validate", async () => { setValidation(await apiRequest<ConfigurationValidationResponse>("/configuration/validate", { method: "GET", accessToken })); }, "Validation complete.")}
            >
              Validate current
            </Button>
          </div>

          {validation ? (
            <div className="rounded-[1rem] border border-border/60 bg-background/75 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={validation.validation.valid ? "success" : "muted"} className={validation.validation.valid ? "" : "border-rose-200 bg-rose-100 text-rose-700"}>
                  {validation.validation.valid ? "Valid" : "Invalid"}
                </Badge>
                <span className="text-xs text-muted-foreground">{validation.validation.errorCount} error(s) · {validation.validation.warningCount} warning(s)</span>
              </div>
              {validation.validation.issues.slice(0, 6).map((issue, index) => (
                <p key={`${issue.code}-${index}`} className="mt-1 text-xs text-muted-foreground">
                  <span className={issue.severity === "error" ? "text-rose-600" : "text-amber-600"}>{issue.severity}</span> · {issue.path}: {issue.message}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Draft versions ({drafts.length})</CardTitle>
            <CardDescription>Publish a validated draft to make it the live configuration version.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {drafts.length === 0 ? <p className="text-muted-foreground">No drafts.</p> : drafts.slice(0, 8).map((version) => (
              <div key={version.id} className="rounded-[1rem] bg-background/75 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Version #{version.versionNumber}</span>
                  <Badge variant="muted">{version.status}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(version.createdAt)}</span>
                </div>
                {version.changeReason ? <p className="mt-1 text-xs text-muted-foreground">{version.changeReason}</p> : null}
                <Button type="button" size="sm" className="mt-2" disabled={busy !== null} onClick={() => void run(`publish-${version.id}`, () => apiRequest<ConfigurationVersion>(`/configuration/versions/${version.id}/publish`, { method: "POST", accessToken, body: {} }), `Version #${version.versionNumber} published.`)}>Publish</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Published versions ({published.length})</CardTitle>
            <CardDescription>Roll back to a previous published version when a change needs to be reverted.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {published.length === 0 ? <p className="text-muted-foreground">No published versions yet.</p> : published.slice(0, 8).map((version) => (
              <div key={version.id} className="rounded-[1rem] bg-background/75 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Version #{version.versionNumber}</span>
                  <Badge variant="success">{version.status}</Badge>
                  <span className="text-xs text-muted-foreground">{version.publishedAt ? formatDateTime(version.publishedAt) : "—"}</span>
                </div>
                {version.changeReason ? <p className="mt-1 text-xs text-muted-foreground">{version.changeReason}</p> : null}
                <Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy !== null} onClick={() => void run(`rollback-${version.id}`, () => apiRequest<ConfigurationVersion>(`/configuration/versions/${version.id}/rollback`, { method: "POST", accessToken, body: {} }), `Rolled back to version #${version.versionNumber} (new draft created).`)}>Roll back to this</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration surfaces</CardTitle>
          <CardDescription>The CRM Administrator configures these governed areas; each publishes through the versioning engine above.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Link to="/admin/rbac" className="rounded-[1rem] border border-border/60 bg-background/75 p-3 hover:border-primary/30"><p className="font-medium">RBAC</p><p className="text-xs text-muted-foreground">Roles, object/field/record/action permissions, teams (ADMIN-001).</p></Link>
          <Link to="/workflows" className="rounded-[1rem] border border-border/60 bg-background/75 p-3 hover:border-primary/30"><p className="font-medium">Workflow automation</p><p className="text-xs text-muted-foreground">Triggers, conditions, actions, history (ADMIN-003).</p></Link>
          <Link to="/approvals" className="rounded-[1rem] border border-border/60 bg-background/75 p-3 hover:border-primary/30"><p className="font-medium">Approvals</p><p className="text-xs text-muted-foreground">Approval matrices, sequential/parallel, SLA (ADMIN-004).</p></Link>
          <Link to="/admin/custom-fields" className="rounded-[1rem] border border-border/60 bg-background/75 p-3 hover:border-primary/30"><p className="font-medium">Fields &amp; layouts</p><p className="text-xs text-muted-foreground">Field metadata and persona layouts (ADMIN-005).</p></Link>
          <Link to="/admin/modules" className="rounded-[1rem] border border-border/60 bg-background/75 p-3 hover:border-primary/30"><p className="font-medium">Modules &amp; BPFs</p><p className="text-xs text-muted-foreground">Enable modules; business-process flows (ADMIN-002).</p></Link>
          <Link to="/admin/terminology" className="rounded-[1rem] border border-border/60 bg-background/75 p-3 hover:border-primary/30"><p className="font-medium">Terminology</p><p className="text-xs text-muted-foreground">Business-facing labels.</p></Link>
        </CardContent>
      </Card>
    </div>
  );
}
