import { useEffect, useState, type FormEvent } from "react";
import type { ProposalContentLibraryResponse, ProposalOptionsResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface ProposalContentLibraryProps {
  accessToken: string | null;
  canManage: boolean;
}

export function ProposalContentLibrary({ accessToken, canManage }: ProposalContentLibraryProps) {
  const [entries, setEntries] = useState<ProposalContentLibraryResponse["entries"]>([]);
  const [categories, setCategories] = useState<ProposalOptionsResponse["contentCategories"]>([]);
  const [form, setForm] = useState({ categoryKey: "", title: "", body: "", status: "approved", expiresAt: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const [library, options] = await Promise.all([
        apiRequest<ProposalContentLibraryResponse>("/proposals/content-library", { method: "GET", accessToken }),
        apiRequest<ProposalOptionsResponse>("/proposals/options", { method: "GET", accessToken })
      ]);
      setEntries(library.entries);
      setCategories(options.contentCategories);
      setLoaded(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken) {
      return;
    }
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      await load();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("create", async () => {
      await apiRequest("/proposals/content-library", { method: "POST", accessToken, body: { categoryKey: form.categoryKey, title: form.title.trim(), body: form.body.trim(), status: form.status, expiresAt: form.expiresAt || null } });
      setForm({ categoryKey: "", title: "", body: "", status: "approved", expiresAt: "" });
    }, "Content added.");
  }

  if (!loaded) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposal content library</CardTitle>
        <CardDescription>Approved, reusable content; expired items are flagged (PB-004). AI recommendation is a governed placeholder.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">No content yet.</p> : (
          entries.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-background/75 p-2 text-sm">
              <span>{entry.title} <span className="text-xs text-muted-foreground">· {entry.category?.label ?? "Uncategorized"}</span></span>
              <span className="flex items-center gap-2">
                <Badge variant={entry.status === "approved" ? "muted" : "default"}>{entry.status}</Badge>
                {entry.expired ? <Badge variant="default">expired</Badge> : null}
                {canManage ? <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`rm-${entry.id}`, () => apiRequest(`/proposals/content-library/${entry.id}`, { method: "DELETE", accessToken }), "Removed.")}>Remove</Button> : null}
              </span>
            </div>
          ))
        )}
        {canManage ? (
          <form className="grid gap-2 md:grid-cols-2 rounded-[1rem] border border-border/60 p-3" onSubmit={handleCreate}>
            <select className={selectClassName} value={form.categoryKey} onChange={(event) => setForm((c) => ({ ...c, categoryKey: event.target.value }))} disabled={busy !== null}>
              <option value="">Category…</option>
              {categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
            </select>
            <Input type="date" aria-label="Expires at" value={form.expiresAt} onChange={(event) => setForm((c) => ({ ...c, expiresAt: event.target.value }))} disabled={busy !== null} />
            <Input placeholder="Title" value={form.title} onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))} disabled={busy !== null} />
            <select className={selectClassName} value={form.status} onChange={(event) => setForm((c) => ({ ...c, status: event.target.value }))} disabled={busy !== null}>
              <option value="approved">Approved</option><option value="draft">Draft</option>
            </select>
            <textarea className={`${textareaClassName} md:col-span-2`} rows={2} placeholder="Body" value={form.body} onChange={(event) => setForm((c) => ({ ...c, body: event.target.value }))} disabled={busy !== null} />
            <div className="md:col-span-2"><Button type="submit" disabled={busy !== null || !form.categoryKey || !form.title.trim() || !form.body.trim()}>Add content</Button></div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
