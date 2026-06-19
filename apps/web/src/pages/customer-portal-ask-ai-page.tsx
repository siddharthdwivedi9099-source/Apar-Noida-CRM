import { useState } from "react";
import type { CustomerPortalAskAiResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api-client";
import { textareaClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";

export function CustomerPortalAskAiPage() {
  const { accessToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<CustomerPortalAskAiResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function askAi() {
    if (!question.trim()) {
      setErrorMessage("Ask a question before submitting.");
      return;
    }

    setIsAsking(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<CustomerPortalAskAiResponse>("/customer-portal/ask-ai", {
        method: "POST",
        accessToken,
        body: { question }
      });
      setAnswer(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "AI answer could not be generated.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <Badge>Customer-safe AI</Badge>
          <CardTitle>Ask AI</CardTitle>
          <CardDescription>
            Answers are restricted to approved customer-visible knowledge. Internal CRM records and restricted sources are not used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className={textareaClassName}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about setup, troubleshooting, training, or product usage..."
          />
          <Button disabled={isAsking || !question.trim()} onClick={() => void askAi()}>
            {isAsking ? "Checking approved knowledge..." : "Ask AI"}
          </Button>
          {errorMessage ? <p className="text-sm font-medium text-destructive">{errorMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Answer</CardTitle>
          <CardDescription>Customer-visible citations are shown with every grounded response.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!answer ? <p className="text-sm text-muted-foreground">Your answer will appear here.</p> : null}
          {answer ? (
            <>
              <div className="rounded-2xl border border-border bg-white/55 p-4 dark:bg-slate-950/35">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge variant={answer.escalated ? "muted" : "success"}>
                    {answer.escalated ? "Needs human help" : "Grounded answer"}
                  </Badge>
                  <Badge variant="muted">{answer.citations.length} citation{answer.citations.length === 1 ? "" : "s"}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7">{answer.answer}</p>
              </div>
              <div className="space-y-3">
                <p className="font-semibold">Citations</p>
                {answer.citations.length === 0 ? <p className="text-sm text-muted-foreground">No approved customer-visible article matched this question.</p> : null}
                {answer.citations.map((citation) => (
                  <div key={citation.articleId} className="rounded-2xl border border-border p-4">
                    <p className="font-semibold">{citation.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{citation.snippet}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
