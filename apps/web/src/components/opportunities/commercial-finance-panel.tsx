import { useEffect, useState, type FormEvent } from "react";
import type { CommercialOptionsResponse, CommercialResponse, CommercialView } from "@crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface CommercialFinancePanelProps {
  opportunityId: string;
  accessToken: string | null;
  canManage: boolean;
}

type LineItem = { id?: string; product: string; quantity: string; unitPrice: string; discountPct: string; taxPct: string };

export function CommercialFinancePanel({ opportunityId, accessToken, canManage }: CommercialFinancePanelProps) {
  const [view, setView] = useState<CommercialView | null>(null);
  const [options, setOptions] = useState<CommercialOptionsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lines, setLines] = useState<LineItem[]>([]);
  const [fees, setFees] = useState({ implementationFees: "", recurringFees: "", paymentTermsKey: "", marginPct: "" });
  const [discount, setDiscount] = useState({ requestedDiscountPct: "", justification: "", marginImpactPct: "", approverUserId: "" });
  const [terms, setTerms] = useState({ termsKey: "", approverUserId: "" });
  const [commission, setCommission] = useState({ partnerId: "", ratePct: "", adjustmentAmount: "", adjustmentReason: "", approverUserId: "" });

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const [commercial, opts] = await Promise.all([
        apiRequest<CommercialResponse>(`/commercial/${opportunityId}`, { method: "GET", accessToken }),
        apiRequest<CommercialOptionsResponse>("/commercial/options", { method: "GET", accessToken })
      ]);
      const v = commercial.commercial;
      setView(v);
      setOptions(opts);
      setLines(v.quote.lineItems.map((item) => ({ id: item.id, product: item.product, quantity: String(item.quantity), unitPrice: String(item.unitPrice), discountPct: String(item.discountPct), taxPct: String(item.taxPct) })));
      setFees({ implementationFees: String(v.quote.implementationFees), recurringFees: String(v.quote.recurringFees), paymentTermsKey: v.quote.paymentTermsKey ?? "", marginPct: v.quote.marginPct === null ? "" : String(v.quote.marginPct) });
      setTerms((current) => ({ ...current, termsKey: v.paymentTerms.termsKey ?? current.termsKey }));
      setCommission((current) => ({ ...current, partnerId: v.commission.partnerId ?? current.partnerId, ratePct: v.commission.ratePct ? String(v.commission.ratePct) : current.ratePct }));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
     
  }, [accessToken, opportunityId]);

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

  const call = (path: string, method: "PUT" | "POST", body: Record<string, unknown>) => apiRequest(`/commercial/${opportunityId}${path}`, { method, accessToken, body });

  function handleQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("quote", () => call("/quote", "PUT", {
      lineItems: lines.filter((line) => line.product.trim()).map((line) => ({ id: line.id, product: line.product.trim(), quantity: Number(line.quantity || 0), unitPrice: Number(line.unitPrice || 0), discountPct: Number(line.discountPct || 0), taxPct: Number(line.taxPct || 0) })),
      implementationFees: Number(fees.implementationFees || 0),
      recurringFees: Number(fees.recurringFees || 0),
      paymentTermsKey: fees.paymentTermsKey || null,
      marginPct: fees.marginPct === "" ? null : Number(fees.marginPct)
    }), "Quote saved.");
  }

  if (!view || !options) {
    return null;
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* FIN-001 */}
      <Card>
        <CardHeader>
          <CardTitle>Quote review</CardTitle>
          <CardDescription>
            Total {formatCurrencyAmount(view.quote.totals.total, view.currency)} · review {view.quote.reviewStatus}.
            {view.quote.deviations.length > 0 ? ` Deviations: ${view.quote.deviations.join("; ")}.` : " No deviations."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {canManage ? (
            <form className="space-y-2" onSubmit={handleQuote}>
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-2 gap-2 md:grid-cols-6">
                  <Input placeholder="Product" value={line.product} onChange={(event) => setLines((c) => c.map((l, i) => i === index ? { ...l, product: event.target.value } : l))} disabled={busy !== null} />
                  <Input type="number" placeholder="Qty" value={line.quantity} onChange={(event) => setLines((c) => c.map((l, i) => i === index ? { ...l, quantity: event.target.value } : l))} disabled={busy !== null} />
                  <Input type="number" placeholder="Unit price" value={line.unitPrice} onChange={(event) => setLines((c) => c.map((l, i) => i === index ? { ...l, unitPrice: event.target.value } : l))} disabled={busy !== null} />
                  <Input type="number" placeholder="Disc %" value={line.discountPct} onChange={(event) => setLines((c) => c.map((l, i) => i === index ? { ...l, discountPct: event.target.value } : l))} disabled={busy !== null} />
                  <Input type="number" placeholder="Tax %" value={line.taxPct} onChange={(event) => setLines((c) => c.map((l, i) => i === index ? { ...l, taxPct: event.target.value } : l))} disabled={busy !== null} />
                  <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setLines((c) => c.filter((_, i) => i !== index))}>Remove</Button>
                </div>
              ))}
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setLines((c) => [...c, { product: "", quantity: "1", unitPrice: "0", discountPct: "0", taxPct: "0" }])}>Add line</Button>
              <div className="grid gap-2 md:grid-cols-4">
                <Input type="number" placeholder="Implementation fees" value={fees.implementationFees} onChange={(event) => setFees((c) => ({ ...c, implementationFees: event.target.value }))} disabled={busy !== null} />
                <Input type="number" placeholder="Recurring fees" value={fees.recurringFees} onChange={(event) => setFees((c) => ({ ...c, recurringFees: event.target.value }))} disabled={busy !== null} />
                <Input type="number" placeholder="Margin %" value={fees.marginPct} onChange={(event) => setFees((c) => ({ ...c, marginPct: event.target.value }))} disabled={busy !== null} />
                <select className={selectClassName} value={fees.paymentTermsKey} onChange={(event) => setFees((c) => ({ ...c, paymentTermsKey: event.target.value }))} disabled={busy !== null}>
                  <option value="">Payment term…</option>
                  {options.paymentTerms.map((term) => <option key={term.key} value={term.key}>{term.label}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy !== null}>Save quote</Button>
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("q-approve", () => call("/quote/review", "POST", { decision: "approved" }), "Quote approved.")}>Approve</Button>
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run("q-changes", () => call("/quote/review", "POST", { decision: "changes_requested" }), "Changes requested.")}>Request changes</Button>
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run("q-reject", () => call("/quote/review", "POST", { decision: "rejected" }), "Quote rejected.")}>Reject</Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* FIN-002 */}
      <Card>
        <CardHeader>
          <CardTitle>Discount governance</CardTitle>
          <CardDescription>
            {view.discount.requirement.requiresApproval ? `Approval required (${view.discount.requirement.tierLabel ?? "tier"})` : "Auto-approved within threshold"} · state {view.discount.state}. AutoCeiling {options.maxAutoDiscountPct ?? "—"}%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <div className="grid gap-2 md:grid-cols-2">
              <Input type="number" placeholder="Requested discount %" value={discount.requestedDiscountPct} onChange={(event) => setDiscount((c) => ({ ...c, requestedDiscountPct: event.target.value }))} disabled={busy !== null} />
              <Input type="number" placeholder="Margin impact %" value={discount.marginImpactPct} onChange={(event) => setDiscount((c) => ({ ...c, marginImpactPct: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Justification" value={discount.justification} onChange={(event) => setDiscount((c) => ({ ...c, justification: event.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={discount.approverUserId} onChange={(event) => setDiscount((c) => ({ ...c, approverUserId: event.target.value }))} disabled={busy !== null}>
                <option value="">Approver…</option>
                {options.approvers.map((approver) => <option key={approver.id} value={approver.id}>{approver.displayName}</option>)}
              </select>
              <div className="md:col-span-2">
                <Button type="button" disabled={busy !== null || !discount.requestedDiscountPct || !discount.approverUserId} onClick={() => void run("discount", () => call("/discount", "POST", { requestedDiscountPct: Number(discount.requestedDiscountPct), justification: discount.justification || null, marginImpactPct: discount.marginImpactPct === "" ? null : Number(discount.marginImpactPct), approverUserId: discount.approverUserId }), "Discount submitted.")}>Submit discount</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* FIN-003 */}
      <Card>
        <CardHeader>
          <CardTitle>Payment terms</CardTitle>
          <CardDescription>{view.paymentTerms.termsKey ?? "Not set"} · {view.paymentTerms.nonStandard ? "non-standard" : "standard"} · state {view.paymentTerms.state}.</CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <div className="flex flex-wrap items-end gap-2">
              <select className={selectClassName} value={terms.termsKey} onChange={(event) => setTerms((c) => ({ ...c, termsKey: event.target.value }))} disabled={busy !== null}>
                <option value="">Term…</option>
                {options.paymentTerms.map((term) => <option key={term.key} value={term.key}>{term.label}{options.standardPaymentTermKeys.includes(term.key) ? "" : " (non-standard)"}</option>)}
              </select>
              <Button type="button" variant="outline" disabled={busy !== null || !terms.termsKey} onClick={() => void run("terms-set", () => call("/payment-terms", "PUT", { termsKey: terms.termsKey }), "Payment term set.")}>Set term</Button>
              <select className={selectClassName} value={terms.approverUserId} onChange={(event) => setTerms((c) => ({ ...c, approverUserId: event.target.value }))} disabled={busy !== null}>
                <option value="">Approver…</option>
                {options.approvers.map((approver) => <option key={approver.id} value={approver.id}>{approver.displayName}</option>)}
              </select>
              <Button type="button" disabled={busy !== null || !terms.termsKey || !terms.approverUserId} onClick={() => void run("terms-submit", () => call("/payment-terms/submit", "POST", { termsKey: terms.termsKey, approverUserId: terms.approverUserId }), "Exception submitted.")}>Submit exception</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* FIN-004 */}
      <Card>
        <CardHeader>
          <CardTitle>Partner commission</CardTitle>
          <CardDescription>
            {formatCurrencyAmount(view.commission.computedAmount, view.currency)} on {formatCurrencyAmount(view.commission.basisAmount, view.currency)} · {view.commission.linkedClosedWon ? "linked to closed-won" : "not closed-won"} · state {view.commission.state}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <div className="grid gap-2 md:grid-cols-2">
              <select className={selectClassName} value={commission.partnerId} onChange={(event) => setCommission((c) => ({ ...c, partnerId: event.target.value }))} disabled={busy !== null}>
                <option value="">Partner…</option>
                {options.partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
              </select>
              <Input type="number" placeholder="Rate %" value={commission.ratePct} onChange={(event) => setCommission((c) => ({ ...c, ratePct: event.target.value }))} disabled={busy !== null} />
              <Input type="number" placeholder="Adjustment amount" value={commission.adjustmentAmount} onChange={(event) => setCommission((c) => ({ ...c, adjustmentAmount: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Adjustment reason" value={commission.adjustmentReason} onChange={(event) => setCommission((c) => ({ ...c, adjustmentReason: event.target.value }))} disabled={busy !== null} />
              <Button type="button" variant="outline" disabled={busy !== null || !commission.ratePct} onClick={() => void run("comm-set", () => call("/commission", "PUT", { partnerId: commission.partnerId || null, ratePct: Number(commission.ratePct), adjustmentAmount: commission.adjustmentAmount === "" ? null : Number(commission.adjustmentAmount), adjustmentReason: commission.adjustmentReason || null }), "Commission saved.")}>Save commission</Button>
              <div className="flex items-end gap-2">
                <select className={selectClassName} value={commission.approverUserId} onChange={(event) => setCommission((c) => ({ ...c, approverUserId: event.target.value }))} disabled={busy !== null}>
                  <option value="">Approver…</option>
                  {options.approvers.map((approver) => <option key={approver.id} value={approver.id}>{approver.displayName}</option>)}
                </select>
                <Button type="button" disabled={busy !== null || !commission.approverUserId} onClick={() => void run("comm-submit", () => call("/commission/submit", "POST", { approverUserId: commission.approverUserId }), "Commission submitted.")}>Submit payout</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
