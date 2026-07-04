import { useEffect, useState } from "react";
import type { DataQualityDashboardResponse, DqEnrichmentQueueResponse, ImportValidationSummary } from "@crm/types";
import { CrmHero, CrmMetricCard } from "@/components/crm/crm-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const SAMPLE_ROWS = JSON.stringify([{ firstName: "Jane", lastName: "Doe", companyName: "Acme", email: "jane@acme.com" }, { firstName: "", lastName: "Roe", companyName: "Beta", email: "bad-email" }], null, 2);

export function DataQualityPage() {
  const { accessToken } = useAuth();
  const [dashboard, setDashboard] = useState<DataQualityDashboardResponse | null>(null);
  const [enrichment, setEnrichment] = useState<DqEnrichmentQueueResponse | null>(null);
  const [rowsText, setRowsText] = useState(SAMPLE_ROWS);
  const [validation, setValidation] = useState<ImportValidationSummary | null>(null);
  const [merge, setMerge] = useState({ masterId: "", duplicateId: "", reason: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadAll() {
    if (!accessToken) return;
    try {
      const [dq, enr] = await Promise.all([
        apiRequest<DataQualityDashboardResponse>("/data-quality/dashboard", { accessToken }),
        apiRequest<DqEnrichmentQueueResponse>("/data-quality/enrichment", { accessToken })
      ]);
      setDashboard(dq);
      setEnrichment(enr);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken) return;
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function parseRows(): Array<Record<string, unknown>> {
    const parsed = JSON.parse(rowsText);
    if (!Array.isArray(parsed)) throw new Error("Rows must be a JSON array.");
    return parsed;
  }

  function downloadErrorReport() {
    if (!validation) return;
    const lines = ["row,field,code,message"];
    for (const row of validation.rows) {
      for (const err of row.errors) {
        lines.push(`${row.rowIndex + 1},${err.field ?? ""},${err.code},"${err.message.replace(/"/g, "'")}"`);
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <CrmHero eyebrow="Data Quality" title="Keep CRM data clean" summary="Completeness, duplicates, validation, enrichment, and safe merges — all in one place." />
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* DQM-001 */}
      {dashboard ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CrmMetricCard label="Lead records" value={String(dashboard.totalRecords)} description="Active leads scanned." />
            <CrmMetricCard label="Completeness" value={`${dashboard.completenessPct}%`} description="Average field completeness." />
            <CrmMetricCard label="Priorities" value={String(dashboard.cleanupPriorities.length)} description={dashboard.cleanupPriorities.join(", ") || "All clear"} />
            <CrmMetricCard label="Signals" value={String(dashboard.signals.filter((s) => s.count > 0).length)} description="Quality issues detected." />
          </section>
          <Card>
            <CardHeader>
              <CardTitle>Data quality dashboard</CardTitle>
              <CardDescription>Completeness, duplicates, invalid emails/phones, missing owners/sources, stale leads, and consent gaps (DQM-001). AI cleanup ranking is a governed placeholder.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              {dashboard.signals.map((s) => (
                <div key={s.key} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
                  <p className="mt-1 font-display text-2xl font-semibold">{s.count}</p>
                  {s.sampleIds.length ? <p className="mt-1 truncate text-[10px] text-muted-foreground" title={s.sampleIds.join(", ")}>drill: {s.sampleIds.slice(0, 3).join(", ")}…</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* DQM-002 */}
      <Card>
        <CardHeader>
          <CardTitle>Import validation</CardTitle>
          <CardDescription>Validate rows before import — mandatory fields, duplicates, format, allowed values, and consent (DQM-002).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <textarea className={textareaClassName} rows={6} value={rowsText} onChange={(e) => setRowsText(e.target.value)} disabled={busy !== null} aria-label="Import rows JSON" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("validate", async () => { const v = await apiRequest<ImportValidationSummary>("/data-quality/import/validate", { method: "POST", accessToken, body: { rows: parseRows() } }); setValidation(v); }, "Validation complete.")}>Validate</Button>
            <Button type="button" variant="ghost" disabled={busy !== null || !validation || validation.errorRows === 0} onClick={downloadErrorReport}>Download error report</Button>
            <Button type="button" disabled={busy !== null || !validation || validation.validRows === 0} onClick={() => void run("commit", async () => { await apiRequest("/data-quality/import/commit", { method: "POST", accessToken, body: { rows: parseRows() } }); await loadAll(); }, "Valid rows imported + logged.")}>Import valid rows</Button>
          </div>
          {validation ? (
            <div className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted" className="border-emerald-200 bg-emerald-100 text-emerald-700">{validation.validRows} valid</Badge>
                <Badge variant="muted" className={validation.errorRows > 0 ? "border-rose-200 bg-rose-100 text-rose-700" : ""}>{validation.errorRows} error rows</Badge>
              </div>
              {validation.rows.filter((r) => !r.valid).slice(0, 6).map((r) => (
                <p key={r.rowIndex} className="mt-1 text-xs text-muted-foreground">Row {r.rowIndex + 1}: {r.errors.map((e) => e.code).join(", ")}</p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* DQM-003 */}
      <Card>
        <CardHeader>
          <CardTitle>Enrichment queue</CardTitle>
          <CardDescription>Incomplete records queued with suggested values; accept, reject, or edit; source + confidence stored (DQM-003).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("gen", async () => { await apiRequest("/data-quality/enrichment/generate", { method: "POST", accessToken, body: {} }); await loadAll(); }, "Enrichment queue generated.")}>Generate queue</Button>
          {enrichment?.entries.length ? enrichment.entries.slice(0, 8).map((e) => (
            <div key={e.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{e.entityType} {e.entityId.slice(0, 8)}…</span>
                <Badge variant="muted">missing: {e.missingFields.join(", ")}</Badge>
                {e.suggestions.email ? <Badge variant="muted">suggest: {e.suggestions.email}</Badge> : null}
                {e.confidence !== null ? <span className="text-xs text-muted-foreground">conf {e.confidence}% · {e.source}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy !== null} onClick={() => void run(`acc-${e.id}`, async () => { await apiRequest(`/data-quality/enrichment/${e.id}/resolve`, { method: "POST", accessToken, body: { decision: "accept" } }); await loadAll(); }, "Enrichment accepted.")}>Accept</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`rej-${e.id}`, async () => { await apiRequest(`/data-quality/enrichment/${e.id}/resolve`, { method: "POST", accessToken, body: { decision: "reject" } }); await loadAll(); }, "Enrichment rejected.")}>Reject</Button>
              </div>
            </div>
          )) : <p className="text-muted-foreground">Queue is empty. Generate to scan for incomplete leads.</p>}
        </CardContent>
      </Card>

      {/* DQM-004 */}
      <Card>
        <CardHeader>
          <CardTitle>Merge duplicates</CardTitle>
          <CardDescription>Choose a master, merge fields, preserve activity, with a mandatory merge reason (DQM-004).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Master lead ID" value={merge.masterId} onChange={(e) => setMerge((c) => ({ ...c, masterId: e.target.value }))} disabled={busy !== null} />
            <Input placeholder="Duplicate lead ID" value={merge.duplicateId} onChange={(e) => setMerge((c) => ({ ...c, duplicateId: e.target.value }))} disabled={busy !== null} />
            <Input className="md:col-span-2" placeholder="Merge reason (required)" value={merge.reason} onChange={(e) => setMerge((c) => ({ ...c, reason: e.target.value }))} disabled={busy !== null} />
          </div>
          <Button type="button" disabled={busy !== null || !merge.masterId || !merge.duplicateId || merge.reason.trim().length < 1} onClick={() => void run("merge", async () => { await apiRequest("/data-quality/merge", { method: "POST", accessToken, body: { masterId: merge.masterId.trim(), duplicateId: merge.duplicateId.trim(), reason: merge.reason.trim(), fieldSelections: {} } }); setMerge({ masterId: "", duplicateId: "", reason: "" }); await loadAll(); }, "Records merged; activity preserved.")}>Merge</Button>
        </CardContent>
      </Card>
    </div>
  );
}
