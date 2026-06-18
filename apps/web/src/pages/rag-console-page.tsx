import { useState } from "react";
import { Link } from "react-router-dom";
import type { RagRetrieveResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmHero } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const inputClassName = "flex h-10 w-full rounded-xl border border-border bg-white/80 px-3 text-sm";

export function RagConsolePage() {
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [includeArticles, setIncludeArticles] = useState(true);
  const [result, setResult] = useState<RagRetrieveResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function handleRetrieve(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !query.trim()) {
      return;
    }
    setErrorMessage(null);
    setIsRunning(true);
    try {
      const res = await apiRequest<RagRetrieveResponse>("/ai/rag/retrieve", { method: "POST", accessToken, body: { query, topK, includeArticles } });
      setResult(res);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="RAG knowledge"
        title="The RAG test console runs permission-aware, tenant-scoped retrieval and returns cited sources."
        summary="Retrieval is keyword-based until vector embeddings are enabled. Results are restricted to the knowledge sources your role may access, and every result carries a source citation. Queries that return nothing are logged as knowledge gaps."
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/knowledge">Back to knowledge base</Link></Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Retrieval query</CardTitle><CardDescription>Test what the RAG foundation would retrieve for a question.</CardDescription></CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={handleRetrieve}>
            <label className="flex-1 space-y-1" style={{ minWidth: "240px" }}><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Query</span>
              <input className={inputClassName} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="How do I reset my password?" required />
            </label>
            <label className="space-y-1"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top K</span>
              <input className={inputClassName} type="number" min={1} max={20} value={topK} onChange={(e) => setTopK(Number(e.target.value))} style={{ width: "90px" }} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={includeArticles} onChange={(e) => setIncludeArticles(e.target.checked)} />Include articles</label>
            <Button type="submit" disabled={isRunning}>{isRunning ? "Retrieving…" : "Retrieve"}</Button>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader><CardTitle>Results</CardTitle><CardDescription>{result.citations.length} citation(s) for “{result.query}”.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">Strategy: {result.retrieval.strategy}</Badge>
              <Badge variant="muted">Vector: {result.retrieval.vectorBackend}</Badge>
              <Badge variant="muted">Embedding: {result.retrieval.embeddingModel}</Badge>
              <Badge variant="muted">Accessible sources: {result.accessibleSourceCount}</Badge>
              <Badge variant="muted">Restricted: {result.restrictedSourceCount}</Badge>
              {result.gapLogged ? <Badge>Gap logged</Badge> : null}
            </div>
            {result.citations.length === 0 ? (
              <p className="text-muted-foreground">No matching knowledge found. A knowledge gap has been recorded.</p>
            ) : (
              <ul className="space-y-2">
                {result.citations.map((citation, index) => (
                  <li key={index} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted">{citation.kind}</Badge>
                      {citation.sourceName ? <Badge variant="muted">{citation.sourceName}</Badge> : null}
                      <Badge variant="muted">score {citation.score}</Badge>
                    </div>
                    <p className="mt-1 font-medium">{citation.kind === "article" ? citation.articleTitle : citation.documentTitle}{citation.chunkIndex !== null ? ` · chunk #${citation.chunkIndex}` : ""}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{citation.snippet}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
