import { useEffect, useMemo, useState } from "react";
import type {
  CustomerPortalKnowledgeArticleDetail,
  CustomerPortalKnowledgeArticleResponse,
  CustomerPortalKnowledgeListResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";

export function CustomerPortalKnowledgePage() {
  const { accessToken } = useAuth();
  const [search, setSearch] = useState("");
  const [articles, setArticles] = useState<CustomerPortalKnowledgeArticleDetail[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadArticles(nextSearch = search) {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const suffix = nextSearch.trim() ? `?search=${encodeURIComponent(nextSearch.trim())}` : "";
      const response = await apiRequest<CustomerPortalKnowledgeListResponse>(`/customer-portal/knowledge${suffix}`, { accessToken });
      const details = await Promise.all(
        response.articles.map((article) =>
          apiRequest<CustomerPortalKnowledgeArticleResponse>(`/customer-portal/knowledge/${article.id}`, { accessToken }).then((detail) => detail.article)
        )
      );
      setArticles(details);
      setSelectedArticleId((currentValue) => currentValue ?? details[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Knowledge base could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadArticles("");
  }, [accessToken]);

  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedArticleId) ?? articles[0] ?? null,
    [articles, selectedArticleId]
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base</CardTitle>
          <CardDescription>Approved customer-visible articles only. Restricted internal knowledge is excluded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer knowledge" />
            <Button variant="outline" onClick={() => void loadArticles()}>
              Search
            </Button>
          </div>
          {errorMessage ? <p className="text-sm font-medium text-destructive">{errorMessage}</p> : null}
          {isLoading ? <p className="text-sm text-muted-foreground">Loading approved articles...</p> : null}
          {!isLoading && articles.length === 0 ? <p className="text-sm text-muted-foreground">No customer-visible knowledge articles yet.</p> : null}
          {articles.map((article) => (
            <button
              key={article.id}
              type="button"
              onClick={() => setSelectedArticleId(article.id)}
              className="w-full rounded-2xl border border-border bg-white/55 p-4 text-left transition hover:bg-white/80 dark:bg-slate-950/35"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{article.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{article.summary ?? "No summary provided."}</p>
                </div>
                <Badge variant={selectedArticle?.id === article.id ? "default" : "muted"}>Approved</Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>{selectedArticle?.title ?? "Select an article"}</CardTitle>
              <CardDescription>
                {selectedArticle ? `Source: ${selectedArticle.sourceName ?? "Customer knowledge"} · Updated ${formatDateTime(selectedArticle.updatedAt)}` : "Open an approved article to read the customer-facing guidance."}
              </CardDescription>
            </div>
            {selectedArticle ? <Badge variant="success">Customer-visible</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          {selectedArticle ? (
            <article className="prose prose-slate max-w-none whitespace-pre-wrap text-sm leading-7 dark:prose-invert">
              {selectedArticle.body ?? selectedArticle.summary ?? "No article body is available yet."}
            </article>
          ) : (
            <p className="text-sm text-muted-foreground">No article selected.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
