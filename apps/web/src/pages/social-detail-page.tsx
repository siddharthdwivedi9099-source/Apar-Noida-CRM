import { useEffect, useState } from "react";
import type { SocialPostResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { formatDateTime, formatShortDate } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useParams } from "react-router-dom";

export function SocialDetailPage() {
  const { postId } = useParams();
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const socialLabel = getModuleLabel("social");
  const socialPostLabel = getModuleLabel("social", "singular");
  const [response, setResponse] = useState<SocialPostResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = hasAnyPermission(["social.edit", "social.assign", "social.approve", "social.configure"]);
  const canDelete = hasAnyPermission(["social.delete", "social.configure"]);

  useEffect(() => {
    if (!accessToken || !postId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        setResponse(
          await apiRequest<SocialPostResponse>(`/social/${postId}`, {
            method: "GET",
            accessToken
          })
        );
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, postId]);

  if (isLoading) {
    return (
      <CrmLoadingState
        title={`Loading ${socialPostLabel.toLowerCase()} detail`}
        description="The page is fetching scheduling context, approval state, linked campaign data, and placeholder AI surfaces."
      />
    );
  }

  const post = response?.post;

  if (!post) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8">
          <p className="font-semibold">This {socialPostLabel.toLowerCase()} could not be loaded.</p>
          <p className="text-sm text-muted-foreground">{errorMessage ?? "The record is unavailable."}</p>
          <Button asChild>
            <Link to="/social">Back to {socialLabel.toLowerCase()}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Social post detail"
        title={`${post.title} is now tracked as a live ${socialPostLabel.toLowerCase()} record.`}
        summary={`This detail view combines scheduling, approvals, channel selection, campaign linkage, and placeholder AI-assisted social operations inside the authenticated tenant workspace.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/social">Back to list</Link>
            </Button>
            {canEdit ? (
              <Button asChild>
                <Link to={`/social/${post.id}/edit`}>Edit {socialPostLabel}</Link>
              </Button>
            ) : null}
            {canDelete ? <Badge variant="muted">Soft delete available from list view</Badge> : null}
          </>
        }
        aside={
          <div className="grid gap-4">
            <CrmMetricCard
              label="Channels"
              value={String(post.channels.length)}
              description="Each post can now map to one or more tenant-configured social channels."
            />
            <CrmMetricCard
              label="Approval"
              value={post.approvalStatus?.label ?? "Not set"}
              description="Approval status remains a first-class workflow signal on the post."
            />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Planning</CardTitle>
              <CardDescription>Caption, creative brief, scheduling, and hashtags all stay visible together for marketers and approvers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {post.status ? <Badge>{post.status.label}</Badge> : null}
                {post.approvalStatus ? <Badge variant="muted">{post.approvalStatus.label}</Badge> : null}
                {post.channels.map((channel) => (
                  <Badge key={`${post.id}-${channel.id}`} variant="muted">
                    {channel.label}
                  </Badge>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.25rem] bg-background/75 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scheduled date</p>
                  <p className="mt-2 text-sm font-medium">
                    {post.scheduledAt ? formatDateTime(post.scheduledAt) : "Not scheduled"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-background/75 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Content owner</p>
                  <p className="mt-2 text-sm font-medium">{post.owner?.displayName ?? "Unassigned"}</p>
                </div>
                <div className="rounded-[1.25rem] bg-background/75 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Campaign linkage</p>
                  <p className="mt-2 text-sm font-medium">{post.campaign?.name ?? "No campaign linked yet."}</p>
                </div>
                <div className="rounded-[1.25rem] bg-background/75 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated</p>
                  <p className="mt-2 text-sm font-medium">{formatShortDate(post.updatedAt)}</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-background/75 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Caption</p>
                <p className="mt-3 text-sm leading-7">{post.caption ?? "Caption not captured yet."}</p>
              </div>

              <div className="rounded-[1.5rem] bg-background/75 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Creative brief</p>
                <p className="mt-3 text-sm leading-7">{post.creativeBrief ?? "Creative brief not captured yet."}</p>
              </div>

              <div className="rounded-[1.5rem] bg-background/75 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hashtags</p>
                <p className="mt-3 text-sm leading-7">{post.hashtags.length ? post.hashtags.join(" ") : "No hashtags planned yet."}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operational placeholders</CardTitle>
              <CardDescription>The engagement, listening, competitor, and lead-intent surfaces are visible now so later integrations land on stable UX.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] bg-background/75 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Engagement placeholder</p>
                <p className="mt-2 text-sm leading-6">{post.engagementPlaceholder.message}</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Lead capture placeholder</p>
                <p className="mt-2 text-sm leading-6">{post.leadCapturePlaceholder.message}</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Listening placeholder</p>
                <p className="mt-2 text-sm leading-6">{post.listeningPlaceholder.message}</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Competitor tracking placeholder</p>
                <p className="mt-2 text-sm leading-6">{post.competitorTrackingPlaceholder.message}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>AI placeholders</CardTitle>
            <CardDescription>{post.aiPlaceholders.governanceHint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {post.aiPlaceholders.actions.length ? (
              post.aiPlaceholders.actions.map((action) => (
                <div key={action.key} className="rounded-[1.25rem] bg-background/75 p-5">
                  <p className="font-semibold">{action.label}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.description}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] bg-background/75 p-5 text-sm leading-6 text-muted-foreground">
                AI placeholder actions are hidden for your current role.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
