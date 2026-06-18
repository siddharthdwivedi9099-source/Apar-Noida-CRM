import { useState } from "react";
import type { CustomerQueryAnswerResponse, RagCitation } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmHero } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const inputClassName = "flex h-11 w-full rounded-xl border border-border bg-white/80 px-3 text-sm";

interface Turn {
  question: string;
  answer: string;
  answerMessageId: string;
  queryLevel: number;
  confidence: number;
  isGrounded: boolean;
  escalated: boolean;
  escalationReason: string | null;
  citations: RagCitation[];
  feedback: "pending" | "helpful" | "not_helpful";
  relatedTicketId: string | null;
}

export function AskAiPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [query, setQuery] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canAsk = hasAnyPermission(["customer_query.use_ai", "customer_query.create", "customer_query.manage_ai", "customer_query.configure"]);

  async function handleAsk(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !query.trim()) {
      return;
    }
    setIsAsking(true);
    setErrorMessage(null);
    const question = query.trim();
    try {
      const res = await apiRequest<CustomerQueryAnswerResponse>("/customer-query/ask", { method: "POST", accessToken, body: { query: question, sessionId: sessionId ?? undefined } });
      setSessionId(res.result.sessionId);
      setTurns((current) => [
        ...current,
        {
          question,
          answer: res.result.answer,
          answerMessageId: res.result.answerMessageId,
          queryLevel: res.result.queryLevel,
          confidence: res.result.confidenceScore,
          isGrounded: res.result.isGrounded,
          escalated: res.result.escalated,
          escalationReason: res.result.escalationReason,
          citations: res.result.citations,
          feedback: "pending",
          relatedTicketId: res.result.relatedTicketId
        }
      ]);
      setQuery("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAsking(false);
    }
  }

  async function sendFeedback(index: number, feedback: "helpful" | "not_helpful") {
    if (!accessToken || !sessionId) {
      return;
    }
    const turn = turns[index];
    try {
      await apiRequest(`/customer-query/sessions/${sessionId}/feedback`, { method: "POST", accessToken, body: { feedback, messageId: turn.answerMessageId } });
      setTurns((current) => current.map((entry, i) => (i === index ? { ...entry, feedback } : entry)));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function createTicket() {
    if (!accessToken || !sessionId) {
      return;
    }
    try {
      await apiRequest(`/customer-query/sessions/${sessionId}/ticket`, { method: "POST", accessToken, body: { note: "Customer requested help from Ask AI." } });
      setTurns((current) => current.map((entry, i) => (i === current.length - 1 ? { ...entry, relatedTicketId: "created" } : entry)));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Customer AI"
        title="Ask AI answers your questions from approved knowledge — grounded, cited, and escalated when needed."
        summary="The assistant retrieves approved knowledge sources before answering, cites where each answer came from, and routes complex or critical questions to our team. It never invents answers."
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader><CardTitle>Ask a question</CardTitle><CardDescription>Answers are grounded in approved knowledge sources.</CardDescription></CardHeader>
        <CardContent>
          {canAsk ? (
            <form className="flex flex-wrap items-center gap-3" onSubmit={handleAsk}>
              <input className={inputClassName} style={{ minWidth: "260px", flex: 1 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="How do I reset my password?" />
              <Button type="submit" disabled={isAsking}>{isAsking ? "Asking…" : "Ask AI"}</Button>
              {sessionId ? <Button type="button" variant="outline" onClick={() => void createTicket()}>Talk to a person</Button> : null}
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Your role does not include access to the customer query assistant.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {turns.map((turn, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5 text-sm">
              <p className="font-semibold">You: {turn.question}</p>
              <div className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge>AI</Badge>
                  <Badge variant="muted">Level {turn.queryLevel}</Badge>
                  <Badge variant="muted">Confidence {(turn.confidence * 100).toFixed(0)}%</Badge>
                  {turn.isGrounded ? <Badge variant="muted">Grounded</Badge> : <Badge variant="muted">No sources</Badge>}
                  {turn.escalated ? <Badge>Escalated{turn.escalationReason ? `: ${turn.escalationReason}` : ""}</Badge> : null}
                </div>
                <p className="whitespace-pre-wrap leading-6">{turn.answer}</p>
                {turn.citations.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sources</p>
                    <ul className="mt-1 space-y-1">
                      {turn.citations.map((citation, ci) => (
                        <li key={ci} className="text-xs text-muted-foreground">• {citation.sourceName ?? "Knowledge"}{citation.documentTitle ? ` — ${citation.documentTitle}` : citation.articleTitle ? ` — ${citation.articleTitle}` : ""}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Was this helpful?</span>
                  <Button size="sm" variant={turn.feedback === "helpful" ? "default" : "outline"} onClick={() => void sendFeedback(index, "helpful")}>Yes</Button>
                  <Button size="sm" variant={turn.feedback === "not_helpful" ? "default" : "outline"} onClick={() => void sendFeedback(index, "not_helpful")}>No</Button>
                  {turn.relatedTicketId ? <Badge variant="muted">Support ticket created</Badge> : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
