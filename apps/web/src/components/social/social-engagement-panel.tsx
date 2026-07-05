import { useEffect, useState } from "react";
import type {
  CaptureSocialLeadResponse,
  SocialInteractionType,
  SocialOptionsResponse,
  SocialResponseEntry
} from "@crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";
import { Link } from "react-router-dom";

const interactionOptions: Array<{ value: SocialInteractionType; label: string }> = [
  { value: "comment", label: "Comment" },
  { value: "dm", label: "Direct message" },
  { value: "mention", label: "Mention" },
  { value: "social_form", label: "Social form" }
];

/**
 * SM-002: convert a social interaction on this post into a CRM lead — the
 * source is auto-marked as the post's channel, campaign/post attribution is
 * stored, duplicate detection runs first, and consent can be captured.
 */
export function SocialLeadCapturePanel({ postId }: { postId: string }) {
  const { accessToken, hasAnyPermission } = useAuth();
  const [form, setForm] = useState({
    interactionType: "comment" as SocialInteractionType,
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
    consentCaptured: false,
    note: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [capturedLeadId, setCapturedLeadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  if (!hasAnyPermission(["leads.create", "social.configure"])) {
    return null;
  }

  async function handleCapture(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const response = await apiRequest<CaptureSocialLeadResponse>(`/social/${postId}/capture-lead`, {
        method: "POST",
        accessToken,
        body: {
          interactionType: form.interactionType,
          firstName: form.firstName,
          lastName: form.lastName,
          companyName: form.companyName,
          email: form.email || null,
          phone: form.phone || null,
          consentCaptured: form.consentCaptured,
          note: form.note || null,
          allowDuplicate
        }
      });
      setCapturedLeadId(response.leadId);
      setMessage(`Lead captured with source "${response.sourceKey}".`);
      setAllowDuplicate(false);
      setForm({ interactionType: form.interactionType, firstName: "", lastName: "", companyName: "", email: "", phone: "", consentCaptured: false, note: "" });
    } catch (error) {
      const text = getErrorMessage(error);
      setErrorMessage(text);
      if (text.toLowerCase().includes("duplicate")) {
        setAllowDuplicate(true);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capture lead from this post</CardTitle>
        <CardDescription>
          Converts a comment, DM, mention, or form response into a CRM lead. The lead source becomes the post&apos;s channel,
          campaign attribution is stored, and duplicate detection runs before creation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCapture}>
          <label className="space-y-2">
            <span className="text-sm font-medium">Interaction</span>
            <select
              className={selectClassName}
              value={form.interactionType}
              onChange={(event) => setForm((c) => ({ ...c, interactionType: event.target.value as SocialInteractionType }))}
            >
              {interactionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Company</span>
            <Input required value={form.companyName} onChange={(event) => setForm((c) => ({ ...c, companyName: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">First name</span>
            <Input required value={form.firstName} onChange={(event) => setForm((c) => ({ ...c, firstName: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Last name</span>
            <Input required value={form.lastName} onChange={(event) => setForm((c) => ({ ...c, lastName: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Email</span>
            <Input type="email" value={form.email} onChange={(event) => setForm((c) => ({ ...c, email: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Phone</span>
            <Input value={form.phone} onChange={(event) => setForm((c) => ({ ...c, phone: event.target.value }))} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Interaction note</span>
            <textarea
              className={textareaClassName}
              rows={2}
              value={form.note}
              onChange={(event) => setForm((c) => ({ ...c, note: event.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.consentCaptured}
              onChange={(event) => setForm((c) => ({ ...c, consentCaptured: event.target.checked }))}
            />
            Consent captured
          </label>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Capturing..." : allowDuplicate ? "Capture anyway (duplicate reviewed)" : "Capture lead"}
            </Button>
            {message ? (
              <p className="text-sm text-emerald-600">
                {message}{" "}
                {capturedLeadId ? (
                  <Link className="underline underline-offset-4" to={`/leads/${capturedLeadId}`}>
                    Open lead
                  </Link>
                ) : null}
              </p>
            ) : null}
            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * SM-004: log a brand-approved (or free-text) response on this post's CRM
 * timeline; sensitive complaints can be escalated to the support manager role.
 */
export function SocialResponsePanel({
  postId,
  responses: initialResponses
}: {
  postId: string;
  responses: SocialResponseEntry[];
}) {
  const { accessToken, hasAnyPermission } = useAuth();
  const [templates, setTemplates] = useState<SocialOptionsResponse["responseTemplates"]>([]);
  const [templateKey, setTemplateKey] = useState("");
  const [responseText, setResponseText] = useState("");
  const [escalate, setEscalate] = useState(false);
  const [responses, setResponses] = useState<SocialResponseEntry[]>(initialResponses);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canRespond = hasAnyPermission(["social.edit", "social.assign", "social.approve", "social.configure"]);

  useEffect(() => {
    if (!accessToken || !canRespond) {
      return;
    }
    void (async () => {
      try {
        const options = await apiRequest<SocialOptionsResponse>("/social/options", { method: "GET", accessToken });
        setTemplates(options.responseTemplates ?? []);
      } catch {
        // Templates stay optional; free-text responses still work.
      }
    })();
  }, [accessToken, canRespond]);

  if (!canRespond) {
    return null;
  }

  const selectedTemplate = templates.find((template) => template.key === templateKey) ?? null;

  async function handleRespond(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await apiRequest<{ responses: SocialResponseEntry[] }>(`/social/${postId}/responses`, {
        method: "POST",
        accessToken,
        body: {
          templateKey: templateKey || null,
          responseText: responseText || null,
          escalate
        }
      });
      setResponses(result.responses);
      setTemplateKey("");
      setResponseText("");
      setEscalate(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Responses</CardTitle>
        <CardDescription>
          Approved response templates keep social replies professional and consistent; every response is logged on the CRM
          record, and sensitive complaints escalate to the support manager.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-3" onSubmit={handleRespond}>
          <label className="space-y-2">
            <span className="text-sm font-medium">Template</span>
            <select
              className={selectClassName}
              value={templateKey}
              onChange={(event) => {
                const nextKey = event.target.value;
                setTemplateKey(nextKey);
                const template = templates.find((entry) => entry.key === nextKey);
                if (template?.body) {
                  setResponseText(template.body);
                }
                if (template?.sensitive) {
                  setEscalate(true);
                }
              }}
            >
              <option value="">Free-text response</option>
              {templates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.label}
                  {template.sensitive ? " (sensitive)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Response</span>
            <textarea
              className={textareaClassName}
              rows={3}
              value={responseText}
              onChange={(event) => setResponseText(event.target.value)}
              placeholder={selectedTemplate?.body ?? "Write the response that was (or will be) posted."}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={escalate} onChange={(event) => setEscalate(event.target.checked)} />
              Escalate to support manager
            </label>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Logging..." : "Log response"}
            </Button>
            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          </div>
        </form>

        <div className="space-y-2">
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No responses logged for this post yet.</p>
          ) : (
            [...responses].reverse().map((entry) => (
              <div key={entry.id} className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-sm leading-6">{entry.response}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {entry.templateKey ? `Template: ${entry.templateKey} • ` : ""}
                  {entry.escalated ? "Escalated to support • " : ""}
                  {new Date(entry.respondedAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
