import { useEffect, useState, type FormEvent } from "react";
import type {
  CreateSocialPostRequestBody,
  SocialOptionsResponse,
  SocialPostResponse,
  UpdateSocialPostRequestBody
} from "@crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmHero, CrmLoadingState } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { formatDateTimeInputValue, selectClassName, textareaClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useNavigate, useParams } from "react-router-dom";

interface SocialFormState {
  title: string;
  caption: string;
  creativeBrief: string;
  hashtagsInput: string;
  scheduledAt: string;
  ownerId: string;
  campaignId: string;
  statusKey: string;
  approvalStatusKey: string;
  channelKeys: string[];
}

const defaultFormState: SocialFormState = {
  title: "",
  caption: "",
  creativeBrief: "",
  hashtagsInput: "",
  scheduledAt: "",
  ownerId: "",
  campaignId: "",
  statusKey: "",
  approvalStatusKey: "",
  channelKeys: []
};

function parseHashtagsInput(value: string) {
  return value
    .split(/[\s,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function SocialFormPage() {
  const { postId } = useParams();
  const isEditMode = Boolean(postId);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const socialLabel = getModuleLabel("social");
  const socialPostLabel = getModuleLabel("social", "singular");
  const [options, setOptions] = useState<SocialOptionsResponse | null>(null);
  const [formState, setFormState] = useState<SocialFormState>(defaultFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const optionsResponse = await apiRequest<SocialOptionsResponse>("/social/options", {
          method: "GET",
          accessToken
        });
        setOptions(optionsResponse);

        if (!isEditMode || !postId) {
          setFormState((currentValue) => ({
            ...currentValue,
            statusKey:
              optionsResponse.statuses.find((status) => status.isDefault)?.key ??
              optionsResponse.statuses[0]?.key ??
              "",
            approvalStatusKey:
              optionsResponse.approvalStatuses.find((status) => status.isDefault)?.key ??
              optionsResponse.approvalStatuses[0]?.key ??
              "",
            channelKeys: optionsResponse.channels[0] ? [optionsResponse.channels[0].key] : []
          }));
          return;
        }

        const postResponse = await apiRequest<SocialPostResponse>(`/social/${postId}`, {
          method: "GET",
          accessToken
        });
        const { post } = postResponse;

        setFormState({
          title: post.title,
          caption: post.caption ?? "",
          creativeBrief: post.creativeBrief ?? "",
          hashtagsInput: post.hashtags.join(" "),
          scheduledAt: formatDateTimeInputValue(post.scheduledAt),
          ownerId: post.owner?.id ?? "",
          campaignId: post.campaign?.id ?? "",
          statusKey: post.status?.key ?? optionsResponse.statuses[0]?.key ?? "",
          approvalStatusKey: post.approvalStatus?.key ?? optionsResponse.approvalStatuses[0]?.key ?? "",
          channelKeys: post.channels.map((channel) => channel.key)
        });
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, isEditMode, postId]);

  function toggleChannel(channelKey: string) {
    setFormState((currentValue) => ({
      ...currentValue,
      channelKeys: currentValue.channelKeys.includes(channelKey)
        ? currentValue.channelKeys.filter((key) => key !== channelKey)
        : [...currentValue.channelKeys, channelKey]
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      title: formState.title,
      caption: formState.caption || null,
      creativeBrief: formState.creativeBrief || null,
      hashtags: parseHashtagsInput(formState.hashtagsInput),
      scheduledAt: formState.scheduledAt ? new Date(formState.scheduledAt).toISOString() : null,
      ownerId: formState.ownerId || null,
      campaignId: formState.campaignId || null,
      statusKey: formState.statusKey,
      approvalStatusKey: formState.approvalStatusKey,
      channelKeys: formState.channelKeys
    } satisfies CreateSocialPostRequestBody & UpdateSocialPostRequestBody;

    try {
      if (payload.channelKeys.length === 0) {
        setErrorMessage("Select at least one channel before saving.");
        setIsSaving(false);
        return;
      }

      const response = isEditMode && postId
        ? await apiRequest<SocialPostResponse>(`/social/${postId}`, {
            method: "PATCH",
            accessToken,
            body: payload
          })
        : await apiRequest<SocialPostResponse>("/social", {
            method: "POST",
            accessToken,
            body: payload
          });

      navigate(`/social/${response.post.id}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={isEditMode ? `Loading ${socialPostLabel.toLowerCase()} for editing` : `Preparing ${socialPostLabel.toLowerCase()} form`}
        description="The page is loading tenant-backed channels, campaigns, owners, and approval states."
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow={isEditMode ? "Social post maintenance" : "Social post creation"}
        title={
          isEditMode
            ? `Update this ${socialPostLabel.toLowerCase()} cleanly and keep the approval trail intact.`
            : `Create a new ${socialPostLabel.toLowerCase()} with channels, schedule, campaign linkage, and approval context from day one.`
        }
        summary={`${socialLabel} defaults come from the tenant configuration engine, while every save is protected by tenant-safe APIs, RBAC, and audit logging.`}
        actions={
          <Button variant="outline" asChild>
            <Link to={isEditMode && postId ? `/social/${postId}` : "/social"}>
              {isEditMode ? "Back to detail" : "Back to list"}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? `Edit ${socialPostLabel}` : `Create ${socialPostLabel}`}</CardTitle>
          <CardDescription>
            Capture planning, approvals, scheduling, and channel distribution for the social workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Post title</span>
              <Input
                required
                value={formState.title}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, title: event.target.value }))}
                placeholder="Q3 launch teaser"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Caption</span>
              <textarea
                className={textareaClassName}
                value={formState.caption}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, caption: event.target.value }))}
                placeholder="Write the planned post copy here."
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Creative brief</span>
              <textarea
                className={textareaClassName}
                value={formState.creativeBrief}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    creativeBrief: event.target.value
                  }))
                }
                placeholder="Summarize the visual direction, asset needs, and messaging guardrails."
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Hashtags</span>
              <Input
                value={formState.hashtagsInput}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    hashtagsInput: event.target.value
                  }))
                }
                placeholder="#launch #product #pipeline"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Scheduled date and time</span>
              <Input
                type="datetime-local"
                value={formState.scheduledAt}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    scheduledAt: event.target.value
                  }))
                }
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Content owner</span>
              <select
                className={selectClassName}
                value={formState.ownerId}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, ownerId: event.target.value }))}
              >
                <option value="">Unassigned</option>
                {options?.owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Campaign linkage</span>
              <select
                className={selectClassName}
                value={formState.campaignId}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, campaignId: event.target.value }))}
              >
                <option value="">No campaign</option>
                {options?.campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Post status</span>
              <select
                className={selectClassName}
                value={formState.statusKey}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, statusKey: event.target.value }))}
              >
                {options?.statuses.map((status) => (
                  <option key={status.id} value={status.key}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Approval status</span>
              <select
                className={selectClassName}
                value={formState.approvalStatusKey}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    approvalStatusKey: event.target.value
                  }))
                }
              >
                {options?.approvalStatuses.map((status) => (
                  <option key={status.id} value={status.key}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-3 md:col-span-2 rounded-[1.5rem] border border-border/70 bg-background/60 p-5">
              <div>
                <h4 className="font-semibold">Channel selection</h4>
                <p className="text-sm text-muted-foreground">
                  Choose the channels this post should appear on. Multi-channel planning is supported from the start.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {options?.channels.map((channel) => (
                  <label
                    key={channel.id}
                    className="flex items-start gap-3 rounded-[1.25rem] bg-background/75 p-4 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-input"
                      checked={formState.channelKeys.includes(channel.key)}
                      onChange={() => toggleChannel(channel.key)}
                    />
                    <span>
                      <span className="block font-medium">{channel.label}</span>
                      <span className="text-muted-foreground">{channel.description ?? "Tenant-configured social channel."}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : isEditMode ? `Save ${socialPostLabel}` : `Create ${socialPostLabel}`}
              </Button>
              {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
