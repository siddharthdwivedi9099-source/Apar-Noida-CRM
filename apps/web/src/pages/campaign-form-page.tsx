import { useEffect, useState, type FormEvent } from "react";
import type {
  CampaignAssetReference,
  CampaignOptionsResponse,
  CampaignResponse,
  CreateCampaignRequestBody,
  UpdateCampaignRequestBody
} from "@crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmHero, CrmLoadingState } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useNavigate, useParams } from "react-router-dom";

interface CampaignFormState {
  name: string;
  description: string;
  typeKey: string;
  objectiveKey: string;
  targetAudience: string;
  budgetAmount: string;
  ownerId: string;
  statusKey: string;
  startDate: string;
  endDate: string;
  channelKey: string;
  relatedAssets: CampaignAssetReference[];
}

const defaultFormState: CampaignFormState = {
  name: "",
  description: "",
  typeKey: "",
  objectiveKey: "",
  targetAudience: "",
  budgetAmount: "",
  ownerId: "",
  statusKey: "",
  startDate: "",
  endDate: "",
  channelKey: "",
  relatedAssets: []
};

export function CampaignFormPage() {
  const { campaignId } = useParams();
  const isEditMode = Boolean(campaignId);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const campaignLabel = getModuleLabel("campaigns", "singular");
  const [options, setOptions] = useState<CampaignOptionsResponse | null>(null);
  const [formState, setFormState] = useState<CampaignFormState>(defaultFormState);
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
        const optionsResponse = await apiRequest<CampaignOptionsResponse>("/campaigns/options", {
          method: "GET",
          accessToken
        });
        setOptions(optionsResponse);

        if (!isEditMode || !campaignId) {
          setFormState((currentValue) => ({
            ...currentValue,
            typeKey: optionsResponse.types.find((type) => type.isDefault)?.key ?? optionsResponse.types[0]?.key ?? "",
            objectiveKey:
              optionsResponse.objectives.find((objective) => objective.isDefault)?.key ??
              optionsResponse.objectives[0]?.key ??
              "",
            statusKey:
              optionsResponse.statuses.find((status) => status.isDefault)?.key ??
              optionsResponse.statuses[0]?.key ??
              "",
            channelKey:
              optionsResponse.channels.find((channel) => channel.isDefault)?.key ??
              optionsResponse.channels[0]?.key ??
              ""
          }));
          return;
        }

        const campaignResponse = await apiRequest<CampaignResponse>(`/campaigns/${campaignId}`, {
          method: "GET",
          accessToken
        });
        const { campaign } = campaignResponse;

        setFormState({
          name: campaign.name,
          description: campaign.description ?? "",
          typeKey: campaign.type?.key ?? optionsResponse.types[0]?.key ?? "",
          objectiveKey: campaign.objective?.key ?? optionsResponse.objectives[0]?.key ?? "",
          targetAudience: campaign.targetAudience ?? "",
          budgetAmount: campaign.budgetAmount !== null ? String(campaign.budgetAmount) : "",
          ownerId: campaign.owner?.id ?? "",
          statusKey: campaign.status?.key ?? optionsResponse.statuses[0]?.key ?? "",
          startDate: campaign.startDate ?? "",
          endDate: campaign.endDate ?? "",
          channelKey: campaign.channel?.key ?? optionsResponse.channels[0]?.key ?? "",
          relatedAssets: campaign.relatedAssets
        });
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, isEditMode, campaignId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      name: formState.name,
      description: formState.description || null,
      typeKey: formState.typeKey,
      objectiveKey: formState.objectiveKey,
      targetAudience: formState.targetAudience || null,
      budgetAmount: formState.budgetAmount ? Number(formState.budgetAmount) : null,
      ownerId: formState.ownerId || null,
      statusKey: formState.statusKey,
      startDate: formState.startDate || null,
      endDate: formState.endDate || null,
      channelKey: formState.channelKey,
      relatedAssets: formState.relatedAssets
        .filter((asset) => asset.label.trim() && asset.url.trim())
        .map((asset) => ({
          label: asset.label.trim(),
          url: asset.url.trim(),
          assetType: asset.assetType?.trim() ? asset.assetType.trim() : null
        }))
    } satisfies CreateCampaignRequestBody & UpdateCampaignRequestBody;

    try {
      const response = isEditMode && campaignId
        ? await apiRequest<CampaignResponse>(`/campaigns/${campaignId}`, {
            method: "PATCH",
            accessToken,
            body: payload
          })
        : await apiRequest<CampaignResponse>("/campaigns", {
            method: "POST",
            accessToken,
            body: payload
          });

      navigate(`/campaigns/${response.campaign.id}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function updateAsset(index: number, field: keyof CampaignAssetReference, value: string) {
    setFormState((currentValue) => ({
      ...currentValue,
      relatedAssets: currentValue.relatedAssets.map((asset, assetIndex) =>
        assetIndex === index
          ? {
              ...asset,
              [field]: field === "assetType" ? value || null : value
            }
          : asset
      )
    }));
  }

  function addAsset() {
    setFormState((currentValue) => ({
      ...currentValue,
      relatedAssets: [...currentValue.relatedAssets, { label: "", url: "", assetType: null }]
    }));
  }

  function removeAsset(index: number) {
    setFormState((currentValue) => ({
      ...currentValue,
      relatedAssets: currentValue.relatedAssets.filter((_, assetIndex) => assetIndex !== index)
    }));
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={isEditMode ? `Loading ${campaignLabel.toLowerCase()} for editing` : `Preparing ${campaignLabel.toLowerCase()} form`}
        description="The page is loading tenant-backed owners, dropdown values, and the current campaign when needed."
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow={isEditMode ? "Campaign maintenance" : "Campaign creation"}
        title={
          isEditMode
            ? `Update this ${campaignLabel.toLowerCase()} cleanly and keep audit history intact.`
            : `Create a new ${campaignLabel.toLowerCase()} with owner, audience, budget, and execution context from day one.`
        }
        summary="Campaign defaults and dropdown values come from the tenant configuration engine, while every save is protected by the campaign API and audit logging."
        actions={
          <Button variant="outline" asChild>
            <Link to={isEditMode && campaignId ? `/campaigns/${campaignId}` : "/campaigns"}>
              {isEditMode ? "Back to detail" : "Back to list"}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? `Edit ${campaignLabel}` : `Create ${campaignLabel}`}</CardTitle>
          <CardDescription>
            Capture strategy, channel, budget, date window, and asset references that power campaign operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Campaign name</span>
              <Input
                required
                value={formState.name}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, name: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Type</span>
              <select
                className={selectClassName}
                value={formState.typeKey}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, typeKey: event.target.value }))}
              >
                {options?.types.map((type) => (
                  <option key={type.id} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Objective</span>
              <select
                className={selectClassName}
                value={formState.objectiveKey}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    objectiveKey: event.target.value
                  }))
                }
              >
                {options?.objectives.map((objective) => (
                  <option key={objective.id} value={objective.key}>
                    {objective.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Status</span>
              <select
                className={selectClassName}
                value={formState.statusKey}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    statusKey: event.target.value
                  }))
                }
              >
                {options?.statuses.map((status) => (
                  <option key={status.id} value={status.key}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Channel</span>
              <select
                className={selectClassName}
                value={formState.channelKey}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    channelKey: event.target.value
                  }))
                }
              >
                {options?.channels.map((channel) => (
                  <option key={channel.id} value={channel.key}>
                    {channel.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Owner</span>
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
              <span className="text-sm font-medium">Budget</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formState.budgetAmount}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    budgetAmount: event.target.value
                  }))
                }
                placeholder="Optional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Start date</span>
              <Input
                type="date"
                value={formState.startDate}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    startDate: event.target.value
                  }))
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">End date</span>
              <Input
                type="date"
                value={formState.endDate}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    endDate: event.target.value
                  }))
                }
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Description</span>
              <textarea
                className={textareaClassName}
                value={formState.description}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    description: event.target.value
                  }))
                }
                placeholder="High-level campaign summary, goals, and execution notes."
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Target audience</span>
              <textarea
                className={textareaClassName}
                value={formState.targetAudience}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    targetAudience: event.target.value
                  }))
                }
                placeholder="Describe the audience, segment, or account list this campaign is meant to reach."
              />
            </label>

            <div className="md:col-span-2 space-y-4 rounded-[1.5rem] border border-border/70 bg-background/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold">Related assets</h4>
                  <p className="text-sm text-muted-foreground">
                    Attach asset references for email drafts, social copy, decks, landing pages, or partner collateral.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={addAsset}>
                  Add asset
                </Button>
              </div>

              {formState.relatedAssets.length === 0 ? (
                <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                  No related assets added yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {formState.relatedAssets.map((asset, index) => (
                    <div key={`asset-${index}`} className="grid gap-4 rounded-[1.25rem] bg-background/75 p-4 md:grid-cols-[1fr_1fr_0.7fr_auto]">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Label</span>
                        <Input
                          value={asset.label}
                          onChange={(event) => updateAsset(index, "label", event.target.value)}
                          placeholder="Launch email copy"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">URL</span>
                        <Input
                          value={asset.url}
                          onChange={(event) => updateAsset(index, "url", event.target.value)}
                          placeholder="https://..."
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Asset type</span>
                        <Input
                          value={asset.assetType ?? ""}
                          onChange={(event) => updateAsset(index, "assetType", event.target.value)}
                          placeholder="email, deck, brief"
                        />
                      </label>
                      <div className="flex items-end">
                        <Button type="button" variant="outline" onClick={() => removeAsset(index)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : isEditMode ? `Save ${campaignLabel}` : `Create ${campaignLabel}`}
              </Button>
              {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
