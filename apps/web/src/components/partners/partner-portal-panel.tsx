import { useEffect, useState, type FormEvent } from "react";
import type { PartnerPortalDealsResponse, PartnerPortalSession, PartnerPortalSessionResponse, PortalCommissionResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface PartnerPortalPanelProps {
  accessToken: string | null;
  canManage: boolean;
}

export function PartnerPortalPanel({ accessToken, canManage }: PartnerPortalPanelProps) {
  const [session, setSession] = useState<PartnerPortalSession | null>(null);
  const [deals, setDeals] = useState<PartnerPortalDealsResponse["deals"]>([]);
  const [commission, setCommission] = useState<PortalCommissionResponse["rows"]>([]);
  const [noAccess, setNoAccess] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ partnerId: "", name: "", customerName: "", product: "", amount: "", expectedCloseDate: "", notes: "" });
  const [collab, setCollab] = useState<Record<string, { type: string; content: string }>>({});

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const sessionResponse = await apiRequest<PartnerPortalSessionResponse>("/partner-portal/session", { method: "GET", accessToken });
      setSession(sessionResponse.session);
      const [dealsResponse, commissionResponse] = await Promise.all([
        apiRequest<PartnerPortalDealsResponse>("/partner-portal/deals", { method: "GET", accessToken }),
        apiRequest<PortalCommissionResponse>("/partner-portal/commission", { method: "GET", accessToken })
      ]);
      setDeals(dealsResponse.deals);
      setCommission(commissionResponse.rows);
    } catch (error) {
      // 403 = this user has no partner portal access; hide the panel.
      if (getErrorMessage(error).toLowerCase().includes("portal access")) {
        setNoAccess(true);
        return;
      }
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
     
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

  function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("register", async () => {
      await apiRequest("/partner-portal/deals", { method: "POST", accessToken, body: { partnerId: form.partnerId, name: form.name.trim(), customerName: form.customerName || null, product: form.product || null, amount: form.amount === "" ? null : Number(form.amount), expectedCloseDate: form.expectedCloseDate || null, notes: form.notes || null } });
      setForm({ partnerId: form.partnerId, name: "", customerName: "", product: "", amount: "", expectedCloseDate: "", notes: "" });
    }, "Deal registered.");
  }

  if (noAccess || !session) {
    return null;
  }

  const commissionByDeal = new Map(commission.map((row) => [row.dealId, row]));

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* RS-001 / RS-002 */}
      <Card>
        <CardHeader>
          <CardTitle>Partner portal (reseller view)</CardTitle>
          <CardDescription>Scoped to {session.partners.map((partner) => partner.name).join(", ")} · {session.dealCount} registered deals (RS-001).</CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <form className="grid gap-2 md:grid-cols-2" onSubmit={handleRegister}>
              <select className={selectClassName} value={form.partnerId} onChange={(event) => setForm((c) => ({ ...c, partnerId: event.target.value }))} disabled={busy !== null}>
                <option value="">Register under partner…</option>
                {session.partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
              </select>
              <Input placeholder="Deal name" value={form.name} onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Customer" value={form.customerName} onChange={(event) => setForm((c) => ({ ...c, customerName: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Product" value={form.product} onChange={(event) => setForm((c) => ({ ...c, product: event.target.value }))} disabled={busy !== null} />
              <Input type="number" placeholder="Value" value={form.amount} onChange={(event) => setForm((c) => ({ ...c, amount: event.target.value }))} disabled={busy !== null} />
              <Input type="date" aria-label="Close date" value={form.expectedCloseDate} onChange={(event) => setForm((c) => ({ ...c, expectedCloseDate: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Notes" value={form.notes} onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))} disabled={busy !== null} />
              <Button type="submit" disabled={busy !== null || !form.partnerId || !form.name.trim()}>Register deal</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* RS-002 status + RS-003 collaboration + RS-004 commission */}
      <Card>
        <CardHeader>
          <CardTitle>My deals</CardTitle>
          <CardDescription>Submission status, collaboration, and commission (RS-002/003/004).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deals.length === 0 ? <p className="text-sm text-muted-foreground">No registered deals yet.</p> : deals.map((deal) => {
            const commissionRow = commissionByDeal.get(deal.id);
            return (
              <div key={deal.id} className="rounded-[1rem] bg-background/75 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{deal.name} · {deal.customerName ?? "—"} · {formatCurrencyAmount(deal.amount)}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="muted">{deal.submissionStatus}</Badge>
                    <Badge variant={deal.commission.status === "payout_approved" ? "muted" : "default"}>comm {deal.commission.status}</Badge>
                  </span>
                </div>
                {deal.decisionNote ? <p className="mt-1 text-xs text-muted-foreground">Vendor: {deal.decisionNote}</p> : null}
                {deal.collaboration.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {deal.collaboration.slice(-4).map((item) => (
                      <p key={item.id} className="text-xs text-muted-foreground">[{item.role}] {item.type}: {item.content}</p>
                    ))}
                  </div>
                ) : null}
                {canManage ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <select className={selectClassName} value={collab[deal.id]?.type ?? "note"} onChange={(event) => setCollab((c) => ({ ...c, [deal.id]: { type: event.target.value, content: c[deal.id]?.content ?? "" } }))} disabled={busy !== null}>
                      <option value="note">Note</option><option value="task">Task</option><option value="meeting_request">Meeting request</option><option value="demo_request">Demo request</option>
                    </select>
                    <Input placeholder="Message" value={collab[deal.id]?.content ?? ""} onChange={(event) => setCollab((c) => ({ ...c, [deal.id]: { type: c[deal.id]?.type ?? "note", content: event.target.value } }))} disabled={busy !== null} />
                    <Button type="button" variant="outline" disabled={busy !== null || !(collab[deal.id]?.content ?? "").trim()} onClick={() => void run(`collab-${deal.id}`, async () => { await apiRequest(`/partner-portal/deals/${deal.id}/collaboration`, { method: "POST", accessToken, body: { type: collab[deal.id]?.type ?? "note", content: collab[deal.id].content.trim() } }); setCollab((c) => ({ ...c, [deal.id]: { type: "note", content: "" } })); }, "Sent.")}>Send</Button>
                    {commissionRow?.closed ? <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`q-${deal.id}`, () => apiRequest(`/partner-portal/deals/${deal.id}/commission-query`, { method: "POST", accessToken, body: { message: "Please confirm my commission payout status." } }), "Commission query raised.")}>Query commission</Button> : null}
                  </div>
                ) : null}
                {commissionRow?.payoutApproved ? <p className="mt-1 text-xs text-emerald-600">Finance-approved payout: {formatCurrencyAmount(commissionRow.commissionAmount)}</p> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
