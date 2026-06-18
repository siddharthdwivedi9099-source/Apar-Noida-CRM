import { useState } from "react";
import { Link } from "react-router-dom";
import type { CustomerQueryAnswer, CustomerQueryAnswerResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmHero } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const inputClassName = "flex h-11 w-full rounded-xl border border-border bg-white/80 px-3 text-sm";

const SUGGESTIONS = ["How do I reset my password?", "Where do I find my dashboard?", "How do I update a record?"];

export function AiHelpPanelPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<CustomerQueryAnswer | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canAsk = hasAnyPermission(["customer_query.use_ai", "customer_query.create", "customer_query.manage_ai", "customer_query.configure"]);

  async function ask(question: string) {
    if (!accessToken || !question.trim()) {
      return;
    }
    setIsAsking(true);
    setErrorMessage(null);
    try {
      const res = await apiRequest<CustomerQueryAnswerResponse>("/customer-query/ask", { method: "POST", accessToken, body: { query: question.trim(), channel: "in_app" } });
      setAnswer(res.result);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="In-app help"
        title="AI Help answers in-product questions instantly from approved knowledge."
        summary="A lightweight assistant for quick, grounded answers while you work. For a full conversation, open Ask AI."
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader><CardTitle>Quick help</CardTitle><CardDescription>Ask a short question.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {canAsk ? (
            <>
              <form className="flex flex-wrap items-center gap-3" onSubmit={(e) => { e.preventDefault(); void ask(query); }}>
                <input className={inputClassName} style={{ minWidth: "240px", flex: 1 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask a quick question…" />
                <Button type="submit" disabled={isAsking}>{isAsking ? "…" : "Ask"}</Button>
              </form>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Button key={suggestion} size="sm" variant="outline" onClick={() => { setQuery(suggestion); void ask(suggestion); }}>{suggestion}</Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Need a conversation? <Link className="underline" to="/ask-ai">Open Ask AI</Link>.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Your role does not include access to AI help.</p>
          )}
        </CardContent>
      </Card>

      {answer ? (
        <Card>
          <CardHeader><CardTitle>Answer</CardTitle><CardDescription>Grounded in approved knowledge.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">Level {answer.queryLevel}</Badge>
              <Badge variant="muted">Confidence {(answer.confidenceScore * 100).toFixed(0)}%</Badge>
              {answer.escalated ? <Badge>Escalated</Badge> : null}
            </div>
            <p className="whitespace-pre-wrap leading-6">{answer.answer}</p>
            {answer.citations.length > 0 ? (
              <ul className="space-y-1">
                {answer.citations.map((citation, ci) => (
                  <li key={ci} className="text-xs text-muted-foreground">• {citation.sourceName ?? "Knowledge"}{citation.documentTitle ? ` — ${citation.documentTitle}` : citation.articleTitle ? ` — ${citation.articleTitle}` : ""}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
