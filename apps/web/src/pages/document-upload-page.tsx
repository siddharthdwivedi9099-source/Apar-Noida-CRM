import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  CreateKnowledgeDocumentRequestBody,
  KnowledgeDocumentDetail,
  KnowledgeDocumentResponse,
  KnowledgeSource,
  KnowledgeSourceListResponse
} from "@crm/types";
import { knowledgeContentFormats, knowledgeSourceTypeLabels } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmHero, CrmLoadingState } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const inputClassName = "flex h-10 w-full rounded-xl border border-border bg-white/80 px-3 text-sm";
const textareaClassName = "flex min-h-[200px] w-full rounded-xl border border-border bg-white/80 px-3 py-2 text-sm";

export function DocumentUploadPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<KnowledgeDocumentDetail | null>(null);
  const [form, setForm] = useState({ sourceId: "", title: "", summary: "", contentFormat: "text", sourceUri: "", content: "" });

  const canCreate = hasAnyPermission(["ai.create", "ai.configure", "ai.manage_ai"]);
  const canProcess = hasAnyPermission(["ai.edit", "ai.configure", "ai.manage_ai"]);

  async function loadSources() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiRequest<KnowledgeSourceListResponse>("/ai/knowledge/sources", { method: "GET", accessToken });
      setSources(res.sources);
      setForm((c) => ({ ...c, sourceId: c.sourceId || res.sources[0]?.id || "" }));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSources();
  }, [accessToken]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !form.sourceId) {
      return;
    }
    setErrorMessage(null);
    try {
      const body: CreateKnowledgeDocumentRequestBody = {
        title: form.title,
        content: form.content,
        summary: form.summary || undefined,
        contentFormat: form.contentFormat as CreateKnowledgeDocumentRequestBody["contentFormat"],
        sourceUri: form.sourceUri || undefined
      };
      const res = await apiRequest<KnowledgeDocumentResponse>(`/ai/knowledge/sources/${form.sourceId}/documents`, { method: "POST", accessToken, body });
      setCreated(res.document);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleProcess() {
    if (!accessToken || !created) {
      return;
    }
    try {
      const res = await apiRequest<KnowledgeDocumentResponse>(`/ai/knowledge/documents/${created.id}/process`, { method: "POST", accessToken, body: {} });
      setCreated(res.document);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading document upload" description="Knowledge sources are loading for ingestion." />;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="RAG knowledge"
        title="Ingest text into the knowledge corpus. Uploads are chunked and embedded (placeholder)."
        summary="File upload and live embeddings are deferred. Paste text here to ingest a document — it is chunked immediately, and the embedding placeholder records a vector reference per chunk so retrieval structure is exercised end-to-end."
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/knowledge">Back to knowledge base</Link></Button>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Text ingestion</CardTitle><CardDescription>Add a document to a knowledge source.</CardDescription></CardHeader>
          <CardContent>
            {canCreate ? (
              <form className="space-y-3" onSubmit={handleSubmit}>
                <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Source</span>
                  <select className={selectClassName} value={form.sourceId} onChange={(e) => setForm((c) => ({ ...c, sourceId: e.target.value }))}>
                    {sources.map((source) => (<option key={source.id} value={source.id}>{source.name} ({knowledgeSourceTypeLabels[source.sourceType]})</option>))}
                  </select>
                </label>
                <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Title</span>
                  <input className={inputClassName} value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} required />
                </label>
                <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Summary</span>
                  <input className={inputClassName} value={form.summary} onChange={(e) => setForm((c) => ({ ...c, summary: e.target.value }))} />
                </label>
                <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Format</span>
                  <select className={selectClassName} value={form.contentFormat} onChange={(e) => setForm((c) => ({ ...c, contentFormat: e.target.value }))}>
                    {knowledgeContentFormats.map((format) => (<option key={format} value={format}>{format}</option>))}
                  </select>
                </label>
                <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Content</span>
                  <textarea className={textareaClassName} value={form.content} onChange={(e) => setForm((c) => ({ ...c, content: e.target.value }))} required />
                </label>
                <Button type="submit">Ingest document</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Your role cannot ingest documents.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ingestion result</CardTitle><CardDescription>Chunks and embedding status.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {created ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{created.status}</Badge>
                  <Badge variant="muted">{created.chunkCount} chunks</Badge>
                  <Badge variant="muted">{created.tokenEstimate} tokens</Badge>
                </div>
                {canProcess && created.status !== "embedded" ? (
                  <Button size="sm" onClick={() => void handleProcess()}>Run embedding placeholder</Button>
                ) : null}
                <ul className="space-y-2">
                  {created.chunks.map((chunk) => (
                    <li key={chunk.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                      <div className="flex flex-wrap items-center gap-2"><Badge variant="muted">#{chunk.chunkIndex}</Badge><Badge variant="muted">{chunk.embeddingStatus}</Badge>{chunk.embeddingModel ? <Badge variant="muted">{chunk.embeddingModel}</Badge> : null}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{chunk.content.slice(0, 160)}{chunk.content.length > 160 ? "…" : ""}</p>
                      {chunk.embeddingRef ? <p className="mt-1 text-[11px] text-muted-foreground">{chunk.embeddingRef}</p> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-muted-foreground">Ingest a document to see its chunks.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
