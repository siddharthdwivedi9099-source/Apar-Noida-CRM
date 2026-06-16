import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  CampaignMemberEntityType,
  CampaignMemberRecordSummary,
  CampaignMemberSummary,
  CampaignOptionsResponse,
  CreateCampaignMemberRequestBody,
  UpdateCampaignMemberRequestBody
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/error-message";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { Link } from "react-router-dom";

interface CampaignMembersManagerProps {
  entityLabel: string;
  members: CampaignMemberSummary[];
  options: Pick<
    CampaignOptionsResponse,
    "memberStatuses" | "leadCandidates" | "contactCandidates" | "accountCandidates"
  >;
  canWrite: boolean;
  onAddMember: (payload: CreateCampaignMemberRequestBody) => Promise<void>;
  onUpdateMember: (memberId: string, payload: UpdateCampaignMemberRequestBody) => Promise<void>;
  onDeleteMember: (memberId: string) => Promise<void>;
}

interface EditableCampaignMemberCardProps {
  member: CampaignMemberSummary;
  memberStatuses: CampaignOptionsResponse["memberStatuses"];
  canWrite: boolean;
  onUpdateMember: (memberId: string, payload: UpdateCampaignMemberRequestBody) => Promise<void>;
  onDeleteMember: (memberId: string) => Promise<void>;
}

function getRecordPath(entityType: CampaignMemberEntityType, entityId: string) {
  switch (entityType) {
    case "lead":
      return `/leads/${entityId}`;
    case "contact":
      return `/contacts/${entityId}`;
    case "account":
      return `/accounts/${entityId}`;
    default:
      return "#";
  }
}

function getMemberEntityLabel(value: CampaignMemberEntityType) {
  switch (value) {
    case "lead":
      return "Lead";
    case "contact":
      return "Contact";
    case "account":
      return "Account";
    default:
      return value;
  }
}

function EditableCampaignMemberCard({
  member,
  memberStatuses,
  canWrite,
  onUpdateMember,
  onDeleteMember
}: EditableCampaignMemberCardProps) {
  const [statusKey, setStatusKey] = useState(member.status?.key ?? "");
  const [responseValue, setResponseValue] = useState(member.response ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatusKey(member.status?.key ?? "");
    setResponseValue(member.response ?? "");
  }, [member]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onUpdateMember(member.id, {
        statusKey: statusKey || null,
        response: responseValue || null
      });
      setMessage("Campaign member updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Remove this member from the campaign?")) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onDeleteMember(member.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-[1.25rem] bg-background/75 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{getMemberEntityLabel(member.record.entityType)}</Badge>
        {member.status ? <Badge variant="default">{member.status.label}</Badge> : null}
        <Link className="font-semibold hover:underline" to={getRecordPath(member.record.entityType, member.record.id)}>
          {member.record.label}
        </Link>
      </div>
      {member.record.secondaryLabel ? (
        <p className="mt-2 text-sm text-muted-foreground">{member.record.secondaryLabel}</p>
      ) : null}
      <p className="mt-3 text-sm leading-6">
        <span className="font-medium">Response:</span> {member.response ?? "No response captured yet."}
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Conversion placeholder: {member.conversionPlaceholder.message}
      </p>

      {canWrite ? (
        <form className="mt-4 grid gap-4 md:grid-cols-[0.8fr_1.2fr_auto]" onSubmit={handleSave}>
          <label className="space-y-2">
            <span className="text-sm font-medium">Status</span>
            <select
              className={selectClassName}
              value={statusKey}
              onChange={(event) => setStatusKey(event.target.value)}
              disabled={isSubmitting}
            >
              <option value="">No status</option>
              {memberStatuses.map((status) => (
                <option key={status.id} value={status.key}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Response</span>
            <Input
              value={responseValue}
              onChange={(event) => setResponseValue(event.target.value)}
              placeholder="Opened email, replied, requested follow-up, and so on"
              disabled={isSubmitting}
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={handleDelete}>
              Remove
            </Button>
          </div>
          {message ? <p className="md:col-span-3 text-sm text-emerald-600">{message}</p> : null}
          {errorMessage ? <p className="md:col-span-3 text-sm text-rose-600">{errorMessage}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

export function CampaignMembersManager({
  entityLabel,
  members,
  options,
  canWrite,
  onAddMember,
  onUpdateMember,
  onDeleteMember
}: CampaignMembersManagerProps) {
  const [memberEntityType, setMemberEntityType] = useState<CampaignMemberEntityType>("lead");
  const [memberEntityId, setMemberEntityId] = useState("");
  const [statusKey, setStatusKey] = useState("");
  const [responseValue, setResponseValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const candidateOptions = useMemo<Record<CampaignMemberEntityType, CampaignMemberRecordSummary[]>>(
    () => ({
      lead: options.leadCandidates,
      contact: options.contactCandidates,
      account: options.accountCandidates
    }),
    [options.accountCandidates, options.contactCandidates, options.leadCandidates]
  );

  const activeCandidates = candidateOptions[memberEntityType];

  useEffect(() => {
    if (!activeCandidates.some((candidate) => candidate.id === memberEntityId)) {
      setMemberEntityId(activeCandidates[0]?.id ?? "");
    }
  }, [activeCandidates, memberEntityId]);

  useEffect(() => {
    setStatusKey(options.memberStatuses.find((status) => status.isDefault)?.key ?? options.memberStatuses[0]?.key ?? "");
  }, [options.memberStatuses]);

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onAddMember({
        memberEntityType,
        memberEntityId,
        statusKey: statusKey || null,
        response: responseValue || null
      });
      setMemberEntityId(activeCandidates[0]?.id ?? "");
      setResponseValue("");
      setMessage(`${entityLabel} member added.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign members</CardTitle>
        <CardDescription>
          Add leads, contacts, and accounts to this {entityLabel.toLowerCase()} while tracking outreach status and response.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">Attached members</h4>
            <Badge variant="muted">{members.length} active</Badge>
          </div>

          {members.length === 0 ? (
            <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
              No leads, contacts, or accounts are attached to this campaign yet.
            </div>
          ) : (
            members.map((member) => (
              <EditableCampaignMemberCard
                key={member.id}
                member={member}
                memberStatuses={options.memberStatuses}
                canWrite={canWrite}
                onUpdateMember={onUpdateMember}
                onDeleteMember={onDeleteMember}
              />
            ))
          )}
        </div>

        {canWrite ? (
          <form className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/70 p-5" onSubmit={handleCreateMember}>
            <div className="space-y-2">
              <h4 className="font-semibold">Add member</h4>
              <p className="text-sm text-muted-foreground">
                Choose the record type, attach the tenant-safe record, and capture the initial response state.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Record type</span>
                <select
                  className={selectClassName}
                  value={memberEntityType}
                  onChange={(event) => setMemberEntityType(event.target.value as CampaignMemberEntityType)}
                  disabled={isSubmitting}
                >
                  <option value="lead">Lead</option>
                  <option value="contact">Contact</option>
                  <option value="account">Account</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Record</span>
                <select
                  className={selectClassName}
                  value={memberEntityId}
                  onChange={(event) => setMemberEntityId(event.target.value)}
                  disabled={isSubmitting || activeCandidates.length === 0}
                >
                  {activeCandidates.length === 0 ? <option value="">No records available</option> : null}
                  {activeCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                      {candidate.secondaryLabel ? ` • ${candidate.secondaryLabel}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Member status</span>
                <select
                  className={selectClassName}
                  value={statusKey}
                  onChange={(event) => setStatusKey(event.target.value)}
                  disabled={isSubmitting}
                >
                  {options.memberStatuses.map((status) => (
                    <option key={status.id} value={status.key}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Response</span>
                <Input
                  value={responseValue}
                  onChange={(event) => setResponseValue(event.target.value)}
                  placeholder="No response yet, interested, follow-up requested..."
                  disabled={isSubmitting}
                />
              </label>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium">Conversion placeholder note</span>
              <textarea
                className={textareaClassName}
                value="Conversion mapping will connect in a later attribution phase."
                readOnly
              />
            </label>
            <Button type="submit" disabled={isSubmitting || !memberEntityId}>
              {isSubmitting ? "Adding member..." : "Add member"}
            </Button>
          </form>
        ) : (
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            You can review campaign members here, but adding or updating them requires additional permissions.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
