import { useEffect, useState, type FormEvent } from "react";
import type { SolutionArchitectureResponse, SolutionArchitectureView } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface SolutionArchitecturePanelProps {
  opportunityId: string;
  accessToken: string | null;
  canManage: boolean;
}

const DISCOVERY_FIELDS: Array<[string, string]> = [
  ["systems", "Systems"], ["integrations", "Integrations"], ["apis", "APIs"], ["authentication", "Authentication"],
  ["dataMigration", "Data migration"], ["hosting", "Hosting"], ["security", "Security"], ["compliance", "Compliance"],
  ["users", "Users"], ["concurrency", "Concurrency"], ["reporting", "Reporting"], ["customWorkflows", "Custom workflows"]
];
const ARCH_FIELDS: Array<[string, string]> = [
  ["frontend", "Frontend"], ["backend", "Backend"], ["database", "Database"], ["integrations", "Integrations"],
  ["aiLayer", "AI layer"], ["analytics", "Analytics"], ["security", "Security"], ["deployment", "Deployment"], ["support", "Support"]
];
const RISK_DIMENSIONS: Array<[string, string]> = [
  ["scopeAmbiguity", "Scope ambiguity"], ["integrationComplexity", "Integration complexity"], ["timelineRisk", "Timeline"],
  ["customization", "Customization"], ["dataMigration", "Data migration"], ["security", "Security"], ["compliance", "Compliance"], ["resourceAvailability", "Resource availability"]
];

export function SolutionArchitecturePanel({ opportunityId, accessToken, canManage }: SolutionArchitecturePanelProps) {
  const [view, setView] = useState<SolutionArchitectureView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [discovery, setDiscovery] = useState<Record<string, string>>({});
  const [arch, setArch] = useState<Record<string, string>>({});
  const [integration, setIntegration] = useState({ system: "", method: "", apiAvailability: "", authentication: "", frequency: "", dataDirection: "", complexity: "medium", owner: "", risk: "low" });
  const [security, setSecurity] = useState({ note: "", items: "" });
  const [risk, setRisk] = useState<Record<string, string>>({});
  const [approverUserId, setApproverUserId] = useState("");

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const response = await apiRequest<SolutionArchitectureResponse>(`/solution-architecture/${opportunityId}`, { method: "GET", accessToken });
      setView(response.architecture);
      setDiscovery(Object.fromEntries(DISCOVERY_FIELDS.map(([key]) => [key, response.architecture.technicalDiscovery[key as keyof typeof response.architecture.technicalDiscovery] ?? ""])) as Record<string, string>);
      setArch(Object.fromEntries(ARCH_FIELDS.map(([key]) => [key, (response.architecture.architecture as unknown as Record<string, string | null>)[key] ?? ""])) as Record<string, string>);
      setRisk(Object.fromEntries(RISK_DIMENSIONS.map(([key]) => [key, response.architecture.deliveryRisk.dimensions[key as keyof typeof response.architecture.deliveryRisk.dimensions]?.level ?? "low"])) as Record<string, string>);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
     
  }, [accessToken, opportunityId]);

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

  const call = (path: string, method: "PUT" | "POST" | "DELETE", body?: Record<string, unknown>) =>
    apiRequest(`/solution-architecture/${opportunityId}${path}`, { method, accessToken, ...(body ? { body } : {}) });

  function handleDiscovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("discovery", () => call("/technical-discovery", "PUT", discovery), "Technical discovery saved.");
  }
  function handleArch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("arch", () => call("/architecture", "PUT", arch), "Architecture saved (draft).");
  }
  function handleIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("integration", async () => {
      await call("/integrations", "POST", integration);
      setIntegration({ system: "", method: "", apiAvailability: "", authentication: "", frequency: "", dataDirection: "", complexity: "medium", owner: "", risk: "low" });
    }, "Integration assessment added.");
  }
  function handleSecurity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = security.items.split("\n").map((line) => line.split("::")).filter((parts) => parts[0]?.trim()).map((parts) => ({ question: parts[0].trim(), answer: parts[1]?.trim() ?? null }));
    void run("security", async () => {
      await call("/security-versions", "POST", { note: security.note || null, items });
      setSecurity({ note: "", items: "" });
    }, "Security questionnaire version saved.");
  }

  if (!view) {
    return null;
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* SA-001 */}
      <Card>
        <CardHeader>
          <CardTitle>Technical discovery</CardTitle>
          <CardDescription>
            {view.technicalDiscoveryStatus.capturedCount}/{view.technicalDiscoveryStatus.totalCount} captured.
            {view.technicalDiscoveryStatus.missingFields.length > 0 ? ` Missing: ${view.technicalDiscoveryStatus.missingFields.join(", ")}.` : " Complete."}
            {" "}AI requirement extraction is a governed placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <form className="grid gap-2 md:grid-cols-2" onSubmit={handleDiscovery}>
              {DISCOVERY_FIELDS.map(([key, label]) => (
                <textarea key={key} className={textareaClassName} rows={2} placeholder={label} value={discovery[key] ?? ""} onChange={(event) => setDiscovery((c) => ({ ...c, [key]: event.target.value }))} disabled={busy !== null} />
              ))}
              <div className="md:col-span-2"><Button type="submit" disabled={busy !== null}>Save discovery</Button></div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* SA-002 */}
      <Card>
        <CardHeader>
          <CardTitle>Architecture recommendation</CardTitle>
          <CardDescription>
            Status: {view.architecture.status}
            {view.architecture.linkedToProposal ? " · linked to proposal" : ""}. AI architecture drafting is a governed placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <form className="grid gap-2 md:grid-cols-2" onSubmit={handleArch}>
              {ARCH_FIELDS.map(([key, label]) => (
                <textarea key={key} className={textareaClassName} rows={2} placeholder={label} value={arch[key] ?? ""} onChange={(event) => setArch((c) => ({ ...c, [key]: event.target.value }))} disabled={busy !== null} />
              ))}
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={busy !== null}>Save architecture</Button>
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("arch-approve", () => call("/architecture/approve", "POST"), "Architecture approved.")}>Approve</Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* SA-003 */}
      <Card>
        <CardHeader>
          <CardTitle>Integration assessments</CardTitle>
          <CardDescription>Effort and risk per integration (SA-003).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {view.integrations.length === 0 ? <p className="text-sm text-muted-foreground">No integrations assessed yet.</p> : (
            view.integrations.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-background/75 p-2 text-sm">
                <span>{item.system} <span className="text-xs text-muted-foreground">{item.method ?? ""}</span></span>
                <span className="flex items-center gap-2">
                  <Badge variant="muted">{item.complexity}</Badge>
                  <Badge variant={item.risk === "high" ? "default" : "muted"}>risk {item.risk}</Badge>
                  <span className="text-xs text-muted-foreground">{item.effortDays}d</span>
                  {canManage ? <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`rm-${item.id}`, () => call(`/integrations/${item.id}`, "DELETE"), "Integration removed.")}>Remove</Button> : null}
                </span>
              </div>
            ))
          )}
          {canManage ? (
            <form className="grid gap-2 md:grid-cols-3 rounded-[1rem] border border-border/60 p-3" onSubmit={handleIntegration}>
              <Input placeholder="System" value={integration.system} onChange={(event) => setIntegration((c) => ({ ...c, system: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Method" value={integration.method} onChange={(event) => setIntegration((c) => ({ ...c, method: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="API availability" value={integration.apiAvailability} onChange={(event) => setIntegration((c) => ({ ...c, apiAvailability: event.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={integration.complexity} onChange={(event) => setIntegration((c) => ({ ...c, complexity: event.target.value }))} disabled={busy !== null}>
                <option value="low">Low complexity</option><option value="medium">Medium complexity</option><option value="high">High complexity</option>
              </select>
              <select className={selectClassName} value={integration.risk} onChange={(event) => setIntegration((c) => ({ ...c, risk: event.target.value }))} disabled={busy !== null}>
                <option value="low">Low risk</option><option value="medium">Medium risk</option><option value="high">High risk</option>
              </select>
              <Button type="submit" disabled={busy !== null || !integration.system.trim()}>Add integration</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* SA-004 */}
      <Card>
        <CardHeader>
          <CardTitle>Security questionnaire</CardTitle>
          <CardDescription>Versioned answers requiring architect approval (SA-004). AI answer suggestions are a governed placeholder.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {view.securityVersions.map((version) => (
            <div key={version.id} className="rounded-[1rem] bg-background/75 p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">v{version.version} · {version.items.length} items {version.approved ? <Badge variant="muted">approved</Badge> : null}</span>
                {canManage && !version.approved ? <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run(`sec-${version.id}`, () => call(`/security-versions/${version.id}/approve`, "POST"), "Version approved.")}>Approve</Button> : null}
              </div>
            </div>
          ))}
          {canManage ? (
            <form className="space-y-2 rounded-[1rem] border border-border/60 p-3" onSubmit={handleSecurity}>
              <Input placeholder="Version note (optional)" value={security.note} onChange={(event) => setSecurity((c) => ({ ...c, note: event.target.value }))} disabled={busy !== null} />
              <textarea className={textareaClassName} rows={3} placeholder="One per line: question :: answer" value={security.items} onChange={(event) => setSecurity((c) => ({ ...c, items: event.target.value }))} disabled={busy !== null} />
              <Button type="submit" disabled={busy !== null || !security.items.trim()}>Save version</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* SA-005 */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery risk</CardTitle>
          <CardDescription>
            Overall {view.deliveryRisk.summary.overall} · status {view.deliveryRisk.status}.
            {view.deliveryRisk.summary.requiresLeadershipApproval ? " High risk requires leadership approval before closure." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {canManage ? (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                {RISK_DIMENSIONS.map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-2 text-sm">
                    <span>{label}</span>
                    <select className={selectClassName} value={risk[key] ?? "low"} onChange={(event) => setRisk((c) => ({ ...c, [key]: event.target.value }))} disabled={busy !== null}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button type="button" disabled={busy !== null} onClick={() => void run("risk-save", () => call("/delivery-risk", "PUT", { dimensions: Object.fromEntries(RISK_DIMENSIONS.map(([key]) => [key, { level: risk[key] ?? "low" }])) }), "Delivery risk saved.")}>Save risk</Button>
                <Input placeholder="Approver user id (high risk)" value={approverUserId} onChange={(event) => setApproverUserId(event.target.value)} disabled={busy !== null} />
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("risk-submit", () => call("/delivery-risk/submit", "POST", { approverUserId: approverUserId || null }), "Delivery risk submitted.")}>Submit for closure</Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
