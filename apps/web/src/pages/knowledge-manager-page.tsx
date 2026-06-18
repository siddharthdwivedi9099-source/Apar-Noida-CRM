import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  CreateKnowledgeSourceRequestBody,
  KnowledgeGapListResponse,
  KnowledgeSource,
  KnowledgeSourceListResponse,
  KnowledgeSourceResponse
} from "@crm/types";
import { knowledgeSourceTypeLabels, knowledgeSourceTypes } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const inputClassName = "flex h-10 w-full rounded-xl border border-border bg-white/80 px-3 text-sm";

export function KnowledgeManagerPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [gaps, setGaps] = useState<KnowledgeGapListResponse["gaps"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{ sourceKey: string; name: string; sourceType: string; accessScope: string; requiredPermission: string }>({ sourceKey: "", name: "", sourceType: "faq", accessScope: "tenant", requiredPermission: "" });

  const canCreate = hasAnyPermission(["ai.create", "ai.configure", "ai.manage_ai"]);
  const canEdit = hasAnyPermission(["ai.edit", "ai.configure", "ai.manage_ai"]);

  async function load() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [sourcesRes, gapsRes] = await Promise.all([
        apiRequest<KnowledgeSourceListResponse>("/ai/knowledge/sources", { method: "GET", accessToken }),
        apiRequest<KnowledgeGapListResponse>("/ai/knowledge/gaps", { method: "GET", accessToken }).catch(() => ({ gaps: [] }))
      ]);
      setSources(sourcesRes.sources);
      setGaps(gapsRes.gaps);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    setErrorMessage(null);
    try {
      const body: CreateKnowledgeSourceRequestBody = {
        sourceKey: form.sourceKey,
        name: form.name,
        sourceType: form.sourceType as CreateKnowledgeSourceRequestBody["sourceType"],
        accessScope: form.accessScope as CreateKnowledgeSourceRequestBody["accessScope"],
        requiredPermission: form.requiredPermission.trim() ? form.requiredPermission.trim() : null
      };
      await apiRequest<KnowledgeSourceResponse>("/ai/knowledge/sources", { method: "POST", accessToken, body });
      setCreateOpen(false);
      setForm({ sourceKey: "", name: "", sourceType: "faq", accessScope: "tenant", requiredPermission: "" });
      await load();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function toggleEnabled(source: KnowledgeSource) {
    if (!accessToken) {
      return;
    }
    try {
      await apiRequest<KnowledgeSourceResponse>(`/ai/knowledge/sources/${source.id}`, { method: "PATCH", accessToken, body: { isEnabled: !source.isEnabled } });
      await load();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading knowledge base" description="Tenant knowledge sources and gap tracking are loading." />;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="RAG knowledge"
        title="The Knowledge Manager governs the corpus the RAG foundation retrieves from."
        summary="Knowledge sources are tenant-scoped and permission-aware. Restricted sources require a permission before their content can be retrieved. Documents are chunked and embedded (placeholder), and approved articles become retrievable knowledge."
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Sources" value={String(sources.length)} description="Knowledge sources for this tenant." />
            <CrmMetricCard label="Restricted" value={String(sources.filter((s) => s.accessScope === "restricted").length)} description="Permission-gated sources." />
            <CrmMetricCard label="Open gaps" value={String(gaps.filter((g) => g.status === "open").length)} description="Tracked knowledge gaps." />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {canCreate ? <Button size="sm" onClick={() => setCreateOpen((open) => !open)}>{createOpen ? "Close" : "New source"}</Button> : null}
        <Button asChild size="sm" variant="outline"><Link to="/knowledge/upload">Upload document</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/knowledge/articles">Article editor</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/knowledge/rag-console">RAG console</Link></Button>
      </div>

      {createOpen && canCreate ? (
        <Card>
          <CardHeader><CardTitle>Create knowledge source</CardTitle><CardDescription>Restricted sources require a permission code for retrieval.</CardDescription></CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleCreate}>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Source key</span>
                <input className={inputClassName} value={form.sourceKey} onChange={(e) => setForm((c) => ({ ...c, sourceKey: e.target.value }))} required />
              </label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name</span>
                <input className={inputClassName} value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required />
              </label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Type</span>
                <select className={selectClassName} value={form.sourceType} onChange={(e) => setForm((c) => ({ ...c, sourceType: e.target.value }))}>
                  {knowledgeSourceTypes.map((type) => (<option key={type} value={type}>{knowledgeSourceTypeLabels[type]}</option>))}
                </select>
              </label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Access scope</span>
                <select className={selectClassName} value={form.accessScope} onChange={(e) => setForm((c) => ({ ...c, accessScope: e.target.value }))}>
                  <option value="tenant">Tenant</option>
                  <option value="restricted">Restricted</option>
                </select>
              </label>
              <label className="space-y-1 block sm:col-span-2"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Required permission (optional)</span>
                <input className={inputClassName} value={form.requiredPermission} onChange={(e) => setForm((c) => ({ ...c, requiredPermission: e.target.value }))} placeholder="e.g. customer_success.view" />
              </label>
              <div className="sm:col-span-2"><Button type="submit">Create source</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Knowledge sources</CardTitle><CardDescription>The corpus categories available to retrieval.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-2">
            {sources.map((source) => (
              <li key={source.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{source.name}</span>
                  <Badge variant="muted">{knowledgeSourceTypeLabels[source.sourceType]}</Badge>
                  {source.accessScope === "restricted" ? <Badge variant="muted">Restricted</Badge> : null}
                  {source.isEnabled ? <Badge>Enabled</Badge> : <Badge variant="muted">Disabled</Badge>}
                  {source.isSystem ? <Badge variant="muted">System</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{source.sourceKey} • {source.documentCount} document(s){source.requiredPermission ? ` • requires ${source.requiredPermission}` : ""}</p>
                {canEdit ? <Button className="mt-2" size="sm" variant="outline" onClick={() => void toggleEnabled(source)}>{source.isEnabled ? "Disable" : "Enable"}</Button> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Knowledge gaps</CardTitle><CardDescription>Queries that returned no results are tracked here (placeholder).</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No knowledge gaps tracked yet.</p>
          ) : (
            <ul className="space-y-2">
              {gaps.slice(0, 20).map((gap) => (
                <li key={gap.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="muted">{gap.status}</Badge><Badge variant="muted">{gap.detectedSource}</Badge></div>
                  <p className="mt-1">{gap.queryText}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
