import { useEffect, useMemo, useState } from "react";
import type {
  AiGatewayResponse,
  AiProvidersResponse,
  AiSettingsResponse,
  AiTemplatesResponse,
  AiUsageLogsResponse,
  AiUsageSummaryResponse,
  UpdateAiSettingsRequestBody
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type AiTab = "assistant" | "settings" | "logs";

export function AiAssistantPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [providers, setProviders] = useState<AiProvidersResponse | null>(null);
  const [templates, setTemplates] = useState<AiTemplatesResponse | null>(null);
  const [settings, setSettings] = useState<AiSettingsResponse["settings"] | null>(null);
  const [usage, setUsage] = useState<AiUsageSummaryResponse | null>(null);
  const [logs, setLogs] = useState<AiUsageLogsResponse | null>(null);
  const [tab, setTab] = useState<AiTab>("assistant");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [execResult, setExecResult] = useState<AiGatewayResponse | null>(null);

  const canUse = hasAnyPermission(["ai.use_ai", "ai.manage_ai", "ai.configure"]);
  const canConfigure = hasAnyPermission(["ai.configure", "ai.manage_ai"]);
  const canViewLogs = hasAnyPermission(["ai.view", "ai.manage_ai", "ai.configure", "ai.view_dashboard"]);

  const selectedTemplate = useMemo(() => templates?.templates.find((t) => t.key === templateKey) ?? null, [templates, templateKey]);

  async function loadAll() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [providersRes, templatesRes, settingsRes, usageRes] = await Promise.all([
        apiRequest<AiProvidersResponse>("/ai/providers", { method: "GET", accessToken }),
        apiRequest<AiTemplatesResponse>("/ai/templates", { method: "GET", accessToken }),
        apiRequest<AiSettingsResponse>("/ai/settings", { method: "GET", accessToken }),
        apiRequest<AiUsageSummaryResponse>("/ai/usage", { method: "GET", accessToken }).catch(() => null)
      ]);
      setProviders(providersRes);
      setTemplates(templatesRes);
      setSettings(settingsRes.settings);
      setUsage(usageRes);
      setTemplateKey((current) => current || templatesRes.templates[0]?.key || "");
      if (canViewLogs) {
        const logsRes = await apiRequest<AiUsageLogsResponse>("/ai/logs?pageSize=50", { method: "GET", accessToken }).catch(() => null);
        setLogs(logsRes);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [accessToken]);

  async function handleExecute(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !templateKey) {
      return;
    }
    setErrorMessage(null);
    try {
      const result = await apiRequest<AiGatewayResponse>("/ai/gateway/execute", { method: "POST", accessToken, body: { templateKey, variables: variableValues } });
      setExecResult(result);
      await loadAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleUpdateSettings(payload: UpdateAiSettingsRequestBody) {
    if (!accessToken) {
      return;
    }
    try {
      const response = await apiRequest<AiSettingsResponse>("/ai/settings", { method: "PATCH", accessToken, body: payload });
      setSettings(response.settings);
      await loadAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading AI gateway" description="AI providers, prompt templates, settings, and usage are loading from the tenant-safe gateway." />;
  }

  if (!providers || !templates || !settings) {
    return <CrmEmptyState title="The AI gateway could not be loaded." description={errorMessage ?? "The current tenant session could not load the AI gateway."} action={<Button variant="outline" onClick={() => void loadAll()}>Retry</Button>} />;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="AI platform"
        title="The AI Gateway centralizes provider routing, prompt templates, permissions, governance, and usage logging."
        summary="Every AI call routes through the governed gateway. Providers are abstracted and configured by environment, prompts live in a managed template registry, and all usage is logged per tenant. Live model execution is deferred — providers return governed placeholders until credentials and the execution phase are enabled."
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Gateway" value={providers.gatewayEnabled ? "Enabled" : "Disabled"} description="Tenant AI gateway status." />
            <CrmMetricCard label="Default provider" value={providers.defaultProvider} description="Active default AI provider." />
            <CrmMetricCard label="AI requests" value={String(usage?.totalRequests ?? 0)} description="Logged AI requests for this tenant." />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader><CardTitle>AI providers</CardTitle><CardDescription>Abstracted providers configured by environment. Placeholders return governed deferred responses.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {providers.providers.map((provider) => (
            <div key={provider.key} className="rounded-[1.25rem] border border-border/70 bg-background/75 p-4">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{provider.label}</span>{provider.isDefault ? <Badge variant="muted">Default</Badge> : null}</div>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">{provider.configured ? "Configured" : "Not configured"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(["assistant", "settings", "logs"] as AiTab[]).map((value) => (
          <Button key={value} variant={tab === value ? "default" : "outline"} size="sm" onClick={() => setTab(value)}>
            {value === "assistant" ? "Assistant" : value === "settings" ? "Settings" : "Logs"}
          </Button>
        ))}
      </div>

      {tab === "assistant" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>AI assistant (placeholder)</CardTitle><CardDescription>Run a prompt template through the gateway. Execution is deferred — the response is a governed placeholder.</CardDescription></CardHeader>
            <CardContent>
              {canUse ? (
                <form className="space-y-3" onSubmit={handleExecute}>
                  <label className="space-y-2 block"><span className="text-sm font-medium">Prompt template</span>
                    <select className={selectClassName} value={templateKey} onChange={(e) => { setTemplateKey(e.target.value); setVariableValues({}); }}>
                      {templates.templates.map((t) => (<option key={t.key} value={t.key}>{t.name}</option>))}
                    </select>
                  </label>
                  {selectedTemplate?.variables.map((variable) => (
                    <label key={variable} className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{variable}</span>
                      <input className="flex h-10 w-full rounded-xl border border-border bg-white/80 px-3 text-sm" value={variableValues[variable] ?? ""} onChange={(e) => setVariableValues((c) => ({ ...c, [variable]: e.target.value }))} />
                    </label>
                  ))}
                  <Button type="submit">Run through gateway</Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">Your role does not include AI usage permission.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Gateway response</CardTitle><CardDescription>The governed placeholder result from the gateway.</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {execResult ? (
                <>
                  <div className="flex flex-wrap items-center gap-2"><Badge>{execResult.status}</Badge><Badge variant="muted">{execResult.provider}</Badge><Badge variant="muted">{execResult.model}</Badge>{execResult.placeholder ? <Badge variant="muted">Deferred</Badge> : null}</div>
                  <p className="leading-6">{execResult.output}</p>
                  <p className="text-xs text-muted-foreground">Tokens {execResult.usage.totalTokens ?? "—"} • Latency {execResult.latencyMs}ms • Rate limit {execResult.rateLimit.limitPerMinute}/min ({execResult.rateLimit.enforced ? "enforced" : "placeholder"})</p>
                  <p className="text-xs text-muted-foreground">Resolved prompt: {execResult.resolvedPrompt}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Run a template to see the gateway response.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {tab === "settings" ? (
        <Card>
          <CardHeader><CardTitle>AI settings</CardTitle><CardDescription>Tenant AI gateway configuration (requires AI configure permission).</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Enabled</dt><dd className="font-medium">{settings.isEnabled ? "Yes" : "No"}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Default provider</dt><dd className="font-medium">{settings.defaultProvider}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Default model</dt><dd className="font-medium">{settings.defaultModel}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Rate limit</dt><dd className="font-medium">{settings.rateLimitPerMinute}/min</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">User overrides</dt><dd className="font-medium">{settings.allowUserOverrides ? "Allowed" : "Blocked"}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Logging</dt><dd className="font-medium">{settings.loggingEnabled ? "On" : "Off"}</dd></div>
            </dl>
            {canConfigure ? (
              <div className="flex flex-wrap gap-3">
                <label className="space-y-1"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Default provider</span>
                  <select className={selectClassName} value={settings.defaultProvider} onChange={(e) => handleUpdateSettings({ defaultProvider: e.target.value as UpdateAiSettingsRequestBody["defaultProvider"] })}>
                    {providers.providers.map((p) => (<option key={p.key} value={p.key}>{p.label}</option>))}
                  </select>
                </label>
                <Button variant="outline" onClick={() => handleUpdateSettings({ isEnabled: !settings.isEnabled })}>{settings.isEnabled ? "Disable AI" : "Enable AI"}</Button>
                <Button variant="outline" onClick={() => handleUpdateSettings({ allowUserOverrides: !settings.allowUserOverrides })}>{settings.allowUserOverrides ? "Block overrides" : "Allow overrides"}</Button>
              </div>
            ) : (
              <p className="text-muted-foreground">Your role cannot modify AI settings.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "logs" ? (
        <section className="space-y-4">
          {usage ? (
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CrmMetricCard label="Total requests" value={String(usage.totalRequests)} description="Logged AI requests." />
              <CrmMetricCard label="Placeholder" value={String(usage.placeholderRequests)} description="Deferred placeholder requests." />
              <CrmMetricCard label="Denied" value={String(usage.deniedRequests)} description="Permission/disabled denials." />
              <CrmMetricCard label="Total tokens" value={String(usage.totalTokens)} description="Estimated tokens logged." />
            </section>
          ) : null}
          <Card>
            <CardHeader><CardTitle>AI usage logs</CardTitle><CardDescription>Per-tenant AI request log (placeholder view).</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {!canViewLogs ? (
                <p className="text-sm text-muted-foreground">Your role cannot view AI logs.</p>
              ) : !logs || logs.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No AI usage logged yet.</p>
              ) : (
                <ul className="space-y-2">
                  {logs.logs.map((log) => (
                    <li key={log.id} className={cn("rounded-[1rem] border border-border/60 bg-background/75 p-3")}>
                      <div className="flex flex-wrap items-center gap-2"><Badge>{log.status}</Badge><Badge variant="muted">{log.provider}</Badge><Badge variant="muted">{log.templateKey ?? "—"}</Badge></div>
                      <p className="mt-1 text-xs text-muted-foreground">{log.model} • {log.totalTokens ?? "—"} tokens • {formatDateTime(log.createdAt)}{log.errorCode ? ` • ${log.errorCode}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
