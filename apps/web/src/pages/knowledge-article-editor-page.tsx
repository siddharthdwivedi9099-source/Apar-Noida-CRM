import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  KnowledgeArticleDetail,
  KnowledgeArticleListResponse,
  KnowledgeArticleResponse,
  KnowledgeArticleStatus,
  KnowledgeArticleSummary
} from "@crm/types";
import { knowledgeArticleStatuses } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const inputClassName = "flex h-10 w-full rounded-xl border border-border bg-white/80 px-3 text-sm";
const textareaClassName = "flex min-h-[160px] w-full rounded-xl border border-border bg-white/80 px-3 py-2 text-sm";

export function KnowledgeArticleEditorPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [articles, setArticles] = useState<KnowledgeArticleSummary[]>([]);
  const [selected, setSelected] = useState<KnowledgeArticleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ articleKey: "", title: "", category: "general", summary: "", body: "" });
  const [versionBody, setVersionBody] = useState("");

  const canCreate = hasAnyPermission(["ai.create", "ai.configure", "ai.manage_ai"]);
  const canEdit = hasAnyPermission(["ai.edit", "ai.configure", "ai.manage_ai"]);
  const canApprove = hasAnyPermission(["ai.approve", "ai.configure", "ai.manage_ai"]);

  async function loadArticles() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiRequest<KnowledgeArticleListResponse>("/ai/knowledge/articles?pageSize=100", { method: "GET", accessToken });
      setArticles(res.articles);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function openArticle(articleId: string) {
    if (!accessToken) {
      return;
    }
    try {
      const res = await apiRequest<KnowledgeArticleResponse>(`/ai/knowledge/articles/${articleId}`, { method: "GET", accessToken });
      setSelected(res.article);
      setVersionBody(res.article.body);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadArticles();
  }, [accessToken]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    setErrorMessage(null);
    try {
      const res = await apiRequest<KnowledgeArticleResponse>("/ai/knowledge/articles", { method: "POST", accessToken, body: form });
      setCreateOpen(false);
      setForm({ articleKey: "", title: "", category: "general", summary: "", body: "" });
      await loadArticles();
      setSelected(res.article);
      setVersionBody(res.article.body);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function mutate(path: string, body: unknown) {
    if (!accessToken || !selected) {
      return;
    }
    setErrorMessage(null);
    try {
      const res = await apiRequest<KnowledgeArticleResponse>(path, { method: "POST", accessToken, body });
      setSelected(res.article);
      await loadArticles();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading knowledge articles" description="Versioned, approval-gated knowledge articles are loading." />;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="RAG knowledge"
        title="The Knowledge Article editor manages versioned, approval-gated articles."
        summary="Articles are versioned like prompts. Only approved and published articles are returned by retrieval, keeping unapproved knowledge out of answers."
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      <div className="flex flex-wrap gap-2">
        {canCreate ? <Button size="sm" onClick={() => setCreateOpen((open) => !open)}>{createOpen ? "Close" : "New article"}</Button> : null}
        <Button asChild size="sm" variant="outline"><Link to="/knowledge">Back to knowledge base</Link></Button>
      </div>

      {createOpen && canCreate ? (
        <Card>
          <CardHeader><CardTitle>Create article</CardTitle><CardDescription>Creates version 1 in draft. Approve and publish to make it retrievable.</CardDescription></CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleCreate}>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Article key</span>
                <input className={inputClassName} value={form.articleKey} onChange={(e) => setForm((c) => ({ ...c, articleKey: e.target.value }))} required />
              </label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Title</span>
                <input className={inputClassName} value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} required />
              </label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Category</span>
                <input className={inputClassName} value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} />
              </label>
              <label className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Summary</span>
                <input className={inputClassName} value={form.summary} onChange={(e) => setForm((c) => ({ ...c, summary: e.target.value }))} />
              </label>
              <label className="space-y-1 block sm:col-span-2"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Body</span>
                <textarea className={textareaClassName} value={form.body} onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))} required />
              </label>
              <div className="sm:col-span-2"><Button type="submit">Create article</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle>Articles</CardTitle><CardDescription>Select an article to edit.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {articles.length === 0 ? <p className="text-sm text-muted-foreground">No articles yet.</p> : (
              <ul className="space-y-2">
                {articles.map((article) => (
                  <li key={article.id}>
                    <button type="button" onClick={() => void openArticle(article.id)} className={`w-full rounded-[1rem] border p-3 text-left ${selected?.id === article.id ? "border-primary bg-primary/5" : "border-border/60 bg-background/75"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{article.title}</span>
                        <Badge variant={article.status === "approved" ? "default" : "muted"}>{article.status}</Badge>
                        {article.isPublished ? <Badge>Published</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{article.articleKey} • v{article.currentVersion}/{article.latestVersion}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader><CardTitle>{selected.title}</CardTitle><CardDescription>{selected.articleKey} • {selected.category}</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={selected.status === "approved" ? "default" : "muted"}>{selected.status}</Badge>
                {selected.isPublished ? <Badge>Published</Badge> : <Badge variant="muted">Unpublished</Badge>}
                <Badge variant="muted">v{selected.currentVersion}/{selected.latestVersion}</Badge>
              </div>
              <div className="rounded-[1rem] border border-border/60 bg-background/75 p-3"><p className="whitespace-pre-wrap leading-6">{selected.body}</p></div>

              {canApprove ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select className={selectClassName} value={selected.status} onChange={(e) => void mutate(`/ai/knowledge/articles/${selected.id}/status`, { status: e.target.value as KnowledgeArticleStatus, isPublished: selected.isPublished && e.target.value === "approved" })}>
                    {knowledgeArticleStatuses.map((status) => (<option key={status} value={status}>{status}</option>))}
                  </select>
                  <Button variant="outline" size="sm" disabled={selected.status !== "approved"} onClick={() => void mutate(`/ai/knowledge/articles/${selected.id}/status`, { status: "approved", isPublished: !selected.isPublished })}>{selected.isPublished ? "Unpublish" : "Publish"}</Button>
                </div>
              ) : null}

              {canEdit ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">New version</p>
                  <textarea className={textareaClassName} value={versionBody} onChange={(e) => setVersionBody(e.target.value)} />
                  <Button size="sm" onClick={() => void mutate(`/ai/knowledge/articles/${selected.id}/versions`, { body: versionBody, activate: true })}>Save new version</Button>
                </div>
              ) : null}

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Version history</p>
                <ul className="mt-2 space-y-2">
                  {selected.versions.map((version) => (
                    <li key={version.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">v{version.version}</span>{version.isActive ? <Badge>Current</Badge> : null}<Badge variant="muted">{version.status}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(version.createdAt)}</span></div>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{version.body.slice(0, 200)}{version.body.length > 200 ? "…" : ""}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          <CrmEmptyState title="Select an article" description="Choose an article to edit its body, manage versions, and control approval and publishing." />
        )}
      </section>
    </div>
  );
}
