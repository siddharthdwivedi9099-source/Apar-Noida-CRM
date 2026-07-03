import { useState } from "react";
import type { CfEntityType, DocumentsResponse, LeadAttributionResponse, MeetingSummariesResponse, NextBestActionResponse, OwnershipHistoryResponse, RecordCommentsResponse } from "@crm/types";
import { cfEntityTypes } from "@crm/types";
import { CrmHero } from "@/components/crm/crm-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

export function RecordToolsPage() {
  const { accessToken } = useAuth();
  const [entityType, setEntityType] = useState<CfEntityType>("opportunity");
  const [entityId, setEntityId] = useState("");
  const [nba, setNba] = useState<NextBestActionResponse | null>(null);
  const [meetings, setMeetings] = useState<MeetingSummariesResponse | null>(null);
  const [ownership, setOwnership] = useState<OwnershipHistoryResponse | null>(null);
  const [docs, setDocs] = useState<DocumentsResponse | null>(null);
  const [comments, setComments] = useState<RecordCommentsResponse | null>(null);
  const [attribution, setAttribution] = useState<LeadAttributionResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [meetForm, setMeetForm] = useState({ title: "", summary: "", nextSteps: "", sentiment: "neutral" });
  const [reassign, setReassign] = useState({ toOwnerId: "", reason: "" });
  const [doc, setDoc] = useState({ name: "", fileRef: "" });
  const [comment, setComment] = useState("");

  const base = () => `/cross-functional/${entityType}/${entityId.trim()}`;

  async function loadAll() {
    if (!accessToken || !entityId.trim()) return;
    setErrorMessage(null);
    try {
      const [n, m, o, d, c] = await Promise.all([
        apiRequest<NextBestActionResponse>(`${base()}/next-best-action`, { accessToken }),
        apiRequest<MeetingSummariesResponse>(`${base()}/meetings`, { accessToken }),
        apiRequest<OwnershipHistoryResponse>(`${base()}/ownership`, { accessToken }),
        apiRequest<DocumentsResponse>(`${base()}/documents`, { accessToken }),
        apiRequest<RecordCommentsResponse>(`${base()}/comments`, { accessToken })
      ]);
      setNba(n); setMeetings(m); setOwnership(o); setDocs(d); setComments(c);
      if (entityType === "lead") {
        setAttribution(await apiRequest<LeadAttributionResponse>(`/cross-functional/leads/${entityId.trim()}/attribution`, { accessToken }));
      } else setAttribution(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function run(key: string, action: () => Promise<unknown>, ok: string) {
    if (!accessToken) return;
    setBusy(key); setMessage(null); setErrorMessage(null);
    try { await action(); await loadAll(); setMessage(ok); }
    catch (error) { setErrorMessage(getErrorMessage(error)); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <CrmHero eyebrow="Record Tools" title="Cross-functional record tools" summary="Next best action, meeting intelligence, ownership, documents, comments, and lead attribution." />
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader><CardTitle>Select a record</CardTitle><CardDescription>Pick an entity type and paste a record ID to load its cross-functional tools.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-2">
            <select className={selectClassName} value={entityType} onChange={(e) => setEntityType(e.target.value as CfEntityType)} aria-label="Entity type">
              {cfEntityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input placeholder="Record ID (UUID)" className="w-80" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
            <Button type="button" disabled={busy !== null || !entityId.trim()} onClick={() => void run("load", async () => undefined, "Loaded.")}>Load</Button>
          </div>
        </CardContent>
      </Card>

      {nba ? (
        <Card>
          <CardHeader><CardTitle>Next best action (CF-005)</CardTitle><CardDescription>{nba.recommendation.reason}</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className="border-primary/30 bg-primary/10 text-primary">{nba.recommendation.actionType.replace(/_/g, " ")}</Badge>
              <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("nba", () => apiRequest(`${base()}/next-best-action`, { method: "POST", accessToken, body: {} }), "Recommendation queued.")}>Queue this action</Button>
            </div>
            {nba.pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2">
                <Badge variant="muted">{p.actionType.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-muted-foreground">{p.status}</span>
                {["accept", "dismiss", "snooze"].map((d) => (
                  <Button key={d} type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`d-${p.id}-${d}`, () => apiRequest(`/cross-functional/next-best-action/${p.id}/decision`, { method: "POST", accessToken, body: { decision: d, snoozeUntil: d === "snooze" ? new Date(Date.now() + 3 * 86400000).toISOString() : null } }), `Action ${d}.`)}>{d}</Button>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {meetings ? (
        <Card>
          <CardHeader><CardTitle>Meeting intelligence (CF-004)</CardTitle><CardDescription>AI summary, decisions, next steps, sentiment — editable before saving. AI generation is a governed placeholder.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <Input placeholder="Meeting title" value={meetForm.title} onChange={(e) => setMeetForm((c) => ({ ...c, title: e.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={meetForm.sentiment} onChange={(e) => setMeetForm((c) => ({ ...c, sentiment: e.target.value }))} disabled={busy !== null} aria-label="Sentiment">
                <option value="positive">positive</option><option value="neutral">neutral</option><option value="negative">negative</option>
              </select>
              <textarea className={textareaClassName} rows={2} placeholder="Summary" value={meetForm.summary} onChange={(e) => setMeetForm((c) => ({ ...c, summary: e.target.value }))} disabled={busy !== null} />
              <textarea className={textareaClassName} rows={2} placeholder="Next steps" value={meetForm.nextSteps} onChange={(e) => setMeetForm((c) => ({ ...c, nextSteps: e.target.value }))} disabled={busy !== null} />
            </div>
            <Button type="button" disabled={busy !== null || !meetForm.title} onClick={() => void run("meet", async () => { await apiRequest(`${base()}/meetings`, { method: "POST", accessToken, body: { title: meetForm.title, summary: meetForm.summary || null, nextSteps: meetForm.nextSteps || null, sentiment: meetForm.sentiment, save: true } }); setMeetForm({ title: "", summary: "", nextSteps: "", sentiment: "neutral" }); }, "Meeting summary saved + linked.")}>Save summary</Button>
            {meetings.meetings.slice(0, 5).map((m) => (
              <div key={m.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-2"><span className="font-medium">{m.title}</span> <Badge variant="muted">{m.sentiment}</Badge> <Badge variant="muted">{m.status}</Badge>{m.summary ? <p className="text-xs text-muted-foreground">{m.summary}</p> : null}</div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {ownership ? (
        <Card>
          <CardHeader><CardTitle>Record ownership (CF-006)</CardTitle><CardDescription>Owner changes require a reason; history is tracked.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {entityType !== "contact" ? (
              <div className="flex flex-wrap items-end gap-2">
                <Input placeholder="New owner ID" className="w-72" value={reassign.toOwnerId} onChange={(e) => setReassign((c) => ({ ...c, toOwnerId: e.target.value }))} disabled={busy !== null} />
                <Input placeholder="Reason (required)" className="w-72" value={reassign.reason} onChange={(e) => setReassign((c) => ({ ...c, reason: e.target.value }))} disabled={busy !== null} />
                <Button type="button" variant="outline" disabled={busy !== null || !reassign.toOwnerId || !reassign.reason} onClick={() => void run("reassign", async () => { await apiRequest(`${base()}/ownership/reassign`, { method: "POST", accessToken, body: reassign }); setReassign({ toOwnerId: "", reason: "" }); }, "Owner reassigned.")}>Reassign</Button>
              </div>
            ) : <p className="text-xs text-muted-foreground">Contacts are not owned.</p>}
            {ownership.history.slice(0, 5).map((h) => <p key={h.id} className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)} — {h.reason}</p>)}
          </CardContent>
        </Card>
      ) : null}

      {docs ? (
        <Card>
          <CardHeader><CardTitle>Documents (CF-009)</CardTitle><CardDescription>Upload references, version history, and lock final approved documents.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="Document name" value={doc.name} onChange={(e) => setDoc((c) => ({ ...c, name: e.target.value }))} disabled={busy !== null} />
              <Input placeholder="File reference / URL" className="w-72" value={doc.fileRef} onChange={(e) => setDoc((c) => ({ ...c, fileRef: e.target.value }))} disabled={busy !== null} />
              <Button type="button" variant="outline" disabled={busy !== null || !doc.name || !doc.fileRef} onClick={() => void run("doc", async () => { await apiRequest(`${base()}/documents`, { method: "POST", accessToken, body: { name: doc.name, fileRef: doc.fileRef } }); setDoc({ name: "", fileRef: "" }); }, "Document added.")}>Add document</Button>
            </div>
            {docs.documents.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-[1rem] border border-border/60 bg-background/75 p-2">
                <span className="font-medium">{d.name}</span><Badge variant="muted">v{d.currentVersion}</Badge>{d.locked ? <Badge variant="muted" className="border-slate-300 bg-slate-100 text-slate-700">locked</Badge> : null}
                {!d.locked ? (
                  <>
                    <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`v-${d.id}`, () => apiRequest(`/cross-functional/documents/${d.id}/versions`, { method: "POST", accessToken, body: { fileRef: `${d.name}-v${d.currentVersion + 1}` } }), "New version added.")}>New version</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`l-${d.id}`, () => apiRequest(`/cross-functional/documents/${d.id}/lock`, { method: "POST", accessToken, body: {} }), "Document locked.")}>Lock</Button>
                  </>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {comments ? (
        <Card>
          <CardHeader><CardTitle>Internal collaboration (CF-010)</CardTitle><CardDescription>@mention teammates; internal comments are hidden from portal users.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="Comment (use @handle to mention)" className="w-full max-w-lg" value={comment} onChange={(e) => setComment(e.target.value)} disabled={busy !== null} />
              <Button type="button" variant="outline" disabled={busy !== null || !comment.trim()} onClick={() => void run("comment", async () => { await apiRequest(`${base()}/comments`, { method: "POST", accessToken, body: { body: comment } }); setComment(""); }, "Comment posted.")}>Post</Button>
            </div>
            {comments.comments.slice(0, 6).map((c) => (
              <div key={c.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-2">
                <p>{c.body}</p>
                {c.mentions.length ? <p className="text-xs text-muted-foreground">mentions: {c.mentions.join(", ")}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {attribution ? (
        <Card>
          <CardHeader><CardTitle>Lead source attribution (CF-001)</CardTitle><CardDescription>Multi-touch attribution — first touch: {attribution.model.firstTouch ?? "—"}, last touch: {attribution.model.lastTouch ?? "—"}.</CardDescription></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {attribution.model.linear.map((l) => <div key={l.source} className="flex items-center gap-2"><Badge variant="muted">{l.source}</Badge><span className="text-xs text-muted-foreground">{l.weight}%</span></div>)}
            {attribution.touches.length === 0 ? <p className="text-muted-foreground">No touches recorded.</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
