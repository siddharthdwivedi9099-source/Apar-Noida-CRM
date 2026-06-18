import { useEffect, useState } from "react";
import type {
  AiApprovalStatus,
  AiPromptListResponse,
  AiPromptResponse,
  AiPromptSummary
} from "@crm/types";
import { aiApprovalStatuses, aiPromptRoles } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const inputClassName = "flex h-10 w-full rounded-xl border border-border bg-white/80 px-3 text-sm";
const textareaClassName = "flex min-h-[120px] w-full rounded-xl border border-border bg-white/80 px-3 py-2 text-sm";

export function PromptRegistryPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [prompts, setPrompts] = useState<AiPromptSummary[]>([]);
  const [selected, setSelected] = useState<AiPromptResponse["prompt"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ promptKey: "", name: "", module: "general", promptRole: "system", content: "", guardrails: "" });
  const [versionContent, setVersionContent] = useState("");
  const [versionActivate, setVersionActivate] = useState(false);

  const canCreate = hasAnyPermission(["ai.create", "ai.configure", "ai.manage_ai"]);
  const canEdit = hasAnyPermission(["ai.edit", "ai.configure", "ai.manage_ai"]);
  const canActivate = hasAnyPermission(["ai.configure", "ai.manage_ai"]);
  const canApprove = hasAnyPermission(["ai.approve", "ai.configure", "ai.manage_ai"]);

  async function loadPrompts() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiRequest<AiPromptListResponse>("/ai/prompts?pageSize=100", { method: "GET", accessToken });
      setPrompts(response.prompts);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function openPrompt(promptId: string) {
    if (!accessToken) {
      return;
    }
    try {
      const response = await apiRequest<AiPromptResponse>(`/ai/prompts/${promptId}`, { method: "GET", accessToken });
      setSelected(response.prompt);
      setVersionContent(response.prompt.activeContent);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadPrompts();
  }, [accessToken]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    setErrorMessage(null);
    try {
      const guardrails = form.guardrails.split("\n").map((rule) => rule.trim()).filter(Boolean);
      const response = await apiRequest<AiPromptResponse>("/ai/prompts", {
        method: "POST",
        accessToken,
        body: { promptKey: form.promptKey, name: form.name, module: form.module, promptRole: form.promptRole, content: form.content, guardrails }
      });
      setCreateOpen(false);
      setForm({ promptKey: "", name: "", module: "general", promptRole: "system", content: "", guardrails: "" });
      await loadPrompts();
      setSelected(response.prompt);
      setVersionContent(response.prompt.activeContent);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function mutateSelected(path: string, body: unknown) {
    if (!accessToken || !selected) {
      return;
    }
    setErrorMessage(null);
    try {
      const response = await apiRequest<AiPromptResponse>(path, { method: "POST", accessToken, body });
      setSelected(response.prompt);
      await loadPrompts();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading prompt registry" description="Governed prompts, versions, and approval state are loading for this tenant." />;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="AI governance"
        title="The Prompt Registry manages versioned, approval-gated prompts with input/output schemas and guardrails."
        summary="Prompts are created, versioned, reviewed, and activated here. No prompt text is hardcoded in business logic — every governed prompt lives in this registry with an approval workflow and a full version history."
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Prompts" value={String(prompts.length)} description="Registered prompts for this tenant." />
            <CrmMetricCard label="Active" value={String(prompts.filter((p) => p.isActive).length)} description="Prompts currently active." />
            <CrmMetricCard label="Approved" value={String(prompts.filter((p) => p.approvalStatus === "approved").length)} description="Approved prompts." />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {canCreate ? (
          <Button size="sm" onClick={() => setCreateOpen((open) => !open)}>{createOpen ? "Close" : "New prompt"}</Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => void loadPrompts()}>Refresh</Button>
      </div>

      {createOpen && canCreate ? (
        <Card>
          <CardHeader><CardTitle>Create prompt</CardTitle><CardDescription>Creates version 1 in draft state. Approve it before activation.</CardDescription></CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleCreate}>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Prompt key</span>
                <input className={inputClassName} value={form.promptKey} onChange={(e) => setForm((c) => ({ ...c, promptKey: e.target.value }))} required />
              </label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name</span>
                <input className={inputClassName} value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required />
              </label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Module</span>
                <input className={inputClassName} value={form.module} onChange={(e) => setForm((c) => ({ ...c, module: e.target.value }))} />
              </label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Prompt role</span>
                <select className={selectClassName} value={form.promptRole} onChange={(e) => setForm((c) => ({ ...c, promptRole: e.target.value }))}>
                  {aiPromptRoles.map((role) => (<option key={role} value={role}>{role}</option>))}
                </select>
              </label>
              <label className="space-y-1 block sm:col-span-2"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Content</span>
                <textarea className={textareaClassName} value={form.content} onChange={(e) => setForm((c) => ({ ...c, content: e.target.value }))} required />
              </label>
              <label className="space-y-1 block sm:col-span-2"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guardrails (one per line)</span>
                <textarea className={textareaClassName} value={form.guardrails} onChange={(e) => setForm((c) => ({ ...c, guardrails: e.target.value }))} />
              </label>
              <div className="sm:col-span-2"><Button type="submit">Create prompt</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle>Prompts</CardTitle><CardDescription>Select a prompt to view versions.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {prompts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prompts registered yet.</p>
            ) : (
              <ul className="space-y-2">
                {prompts.map((prompt) => (
                  <li key={prompt.id}>
                    <button type="button" onClick={() => void openPrompt(prompt.id)} className={`w-full rounded-[1rem] border p-3 text-left ${selected?.id === prompt.id ? "border-primary bg-primary/5" : "border-border/60 bg-background/75"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{prompt.name}</span>
                        {prompt.isActive ? <Badge>Active</Badge> : <Badge variant="muted">Inactive</Badge>}
                        <Badge variant="muted">{prompt.approvalStatus}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{prompt.promptKey} • {prompt.module} • v{prompt.currentVersion}/{prompt.latestVersion}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle>{selected.name}</CardTitle>
              <CardDescription>{selected.promptKey} • {selected.promptRole} role • module {selected.module}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {selected.isActive ? <Badge>Active</Badge> : <Badge variant="muted">Inactive</Badge>}
                <Badge variant="muted">Approval: {selected.approvalStatus}</Badge>
                <Badge variant="muted">Current v{selected.currentVersion}</Badge>
                <Badge variant="muted">Latest v{selected.latestVersion}</Badge>
              </div>

              <div className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Active content</p>
                <p className="mt-1 whitespace-pre-wrap leading-6">{selected.activeContent}</p>
              </div>

              {selected.guardrails.length > 0 ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guardrails</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">{selected.guardrails.map((rule, index) => (<li key={index}>{rule}</li>))}</ul>
                </div>
              ) : null}

              {canApprove || canActivate ? (
                <div className="flex flex-wrap items-center gap-2">
                  {canApprove ? (
                    <select className={selectClassName} value={selected.approvalStatus} onChange={(e) => void mutateSelected(`/ai/prompts/${selected.id}/approval`, { approvalStatus: e.target.value as AiApprovalStatus })}>
                      {aiApprovalStatuses.map((status) => (<option key={status} value={status}>{status}</option>))}
                    </select>
                  ) : null}
                  {canActivate ? (
                    <Button variant="outline" size="sm" onClick={() => void mutateSelected(`/ai/prompts/${selected.id}/active`, { isActive: !selected.isActive })}>{selected.isActive ? "Deactivate" : "Activate"}</Button>
                  ) : null}
                </div>
              ) : null}

              {canEdit ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">New version</p>
                  <textarea className={textareaClassName} value={versionContent} onChange={(e) => setVersionContent(e.target.value)} />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={versionActivate} onChange={(e) => setVersionActivate(e.target.checked)} />Set as current version</label>
                  <Button size="sm" onClick={() => void mutateSelected(`/ai/prompts/${selected.id}/versions`, { content: versionContent, activate: versionActivate })}>Save new version</Button>
                </div>
              ) : null}

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Version history</p>
                <ul className="mt-2 space-y-2">
                  {selected.versions.map((version) => (
                    <li key={version.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">v{version.version}</span>
                        {version.isActive ? <Badge>Current</Badge> : null}
                        <Badge variant="muted">{version.approvalStatus}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(version.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{version.content}</p>
                      {version.changeSummary ? <p className="mt-1 text-xs text-muted-foreground">Change: {version.changeSummary}</p> : null}
                      {!version.isActive && canActivate ? (
                        <Button className="mt-2" size="sm" variant="outline" onClick={() => void mutateSelected(`/ai/prompts/${selected.id}/versions/${version.version}/activate`, {})}>Make current</Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          <CrmEmptyState title="Select a prompt" description="Choose a prompt from the list to view its versions, guardrails, and approval state." />
        )}
      </section>
    </div>
  );
}
