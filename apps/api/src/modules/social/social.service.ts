import type {
  CreateSocialPostRequestBody,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmOptionValueSummary,
  CrmPagination,
  RoleSummary,
  SocialChannelsResponse,
  SocialLinkedCampaignSummary,
  SocialOptionsResponse,
  SocialPostDetail,
  SocialPostListQuery,
  SocialPostResponse,
  SocialPostSummary,
  SocialPostsResponse,
  UpdateSocialPostRequestBody
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { getPositiveNumber } from "../../common/pagination.js";
import { DatabaseService } from "../../platform/database/database.service.js";

interface AuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface ActorContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
  roles: RoleSummary[];
}

interface UserLookupRow {
  id: string;
  display_name: string;
  email: string;
  team_name: string | null;
  department_name: string | null;
}

interface OptionValueRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface SocialPostRecordRow {
  id: string;
  title: string;
  caption: string | null;
  creative_brief: string | null;
  hashtags: string[] | null;
  scheduled_at: Date | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_status_id: string | null;
  campaign_status_key: string | null;
  campaign_status_label: string | null;
  campaign_status_description: string | null;
  campaign_status_color: string | null;
  campaign_status_is_default: boolean | null;
  campaign_status_is_active: boolean | null;
  status_id: string | null;
  status_key: string | null;
  status_label: string | null;
  status_description: string | null;
  status_color: string | null;
  status_is_default: boolean | null;
  status_is_active: boolean | null;
  approval_status_id: string | null;
  approval_status_key: string | null;
  approval_status_label: string | null;
  approval_status_description: string | null;
  approval_status_color: string | null;
  approval_status_is_default: boolean | null;
  approval_status_is_active: boolean | null;
}

interface SocialPostStateRow {
  id: string;
  title: string;
  caption: string | null;
  creative_brief: string | null;
  hashtags: string[] | null;
  scheduled_at: Date | null;
  owner_id: string | null;
  campaign_id: string | null;
  status_option_id: string;
  approval_status_option_id: string;
  metadata: Record<string, unknown> | null;
}

interface SocialChannelRow {
  social_post_id: string;
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface CampaignLookupRow {
  id: string;
  name: string;
  status_id: string | null;
  status_key: string | null;
  status_label: string | null;
  status_description: string | null;
  status_color: string | null;
  status_is_default: boolean | null;
  status_is_active: boolean | null;
}

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function getMetadata(value: Record<string, unknown> | null | undefined) {
  return value ?? {};
}

function getTrimmedNullableString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getPagination(total: number, page: number, pageSize: number): CrmPagination {
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

function mapUser(input: {
  id: string | null;
  displayName: string | null;
  email: string | null;
  teamName: string | null;
  departmentName: string | null;
}): CrmLookupUserSummary | null {
  if (!input.id || !input.displayName || !input.email) {
    return null;
  }

  return {
    id: input.id,
    displayName: input.displayName,
    email: input.email,
    teamName: input.teamName,
    departmentName: input.departmentName
  };
}

function mapOptionValue(input: {
  id: string | null;
  key: string | null;
  label: string | null;
  description: string | null;
  color: string | null;
  isDefault: boolean | null;
  isActive: boolean | null;
}): CrmOptionValueSummary | null {
  if (!input.id || !input.key || !input.label) {
    return null;
  }

  return {
    id: input.id,
    key: input.key,
    label: input.label,
    description: input.description,
    color: input.color,
    isDefault: Boolean(input.isDefault),
    isActive: Boolean(input.isActive)
  };
}

function normalizeHashtags(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = new Map<string, string>();

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmedValue = entry.trim().replace(/\s+/g, "");

    if (!trimmedValue) {
      continue;
    }

    const hashtag = trimmedValue.startsWith("#") ? trimmedValue : `#${trimmedValue}`;
    const key = hashtag.toLowerCase();

    if (!normalized.has(key)) {
      normalized.set(key, hashtag);
    }
  }

  return Array.from(normalized.values());
}

function buildCampaignLink(row: SocialPostRecordRow): SocialLinkedCampaignSummary | null {
  if (!row.campaign_id || !row.campaign_name) {
    return null;
  }

  return {
    id: row.campaign_id,
    name: row.campaign_name,
    status: mapOptionValue({
      id: row.campaign_status_id,
      key: row.campaign_status_key,
      label: row.campaign_status_label,
      description: row.campaign_status_description,
      color: row.campaign_status_color,
      isDefault: row.campaign_status_is_default,
      isActive: row.campaign_status_is_active
    })
  };
}

export class SocialService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Social media marketing is unavailable until the database connection is enabled.",
        undefined,
        "SOCIAL_UNAVAILABLE"
      );
    }
  }

  private async recordAuditLog(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: {
      action: string;
      resourceType: string;
      resourceId?: string | null;
      status: "success" | "failure" | "denied" | "error";
      metadata?: Record<string, unknown>;
    }
  ) {
    if (!this.config.enableAuditLogs) {
      return;
    }

    await client.query(
      `
        INSERT INTO audit_logs (
          tenant_id,
          actor_user_id,
          session_id,
          event_type,
          action,
          resource_type,
          resource_id,
          status,
          ip_address,
          user_agent,
          request_id,
          metadata
        )
        VALUES ($1, $2, $3, 'crm', $4, $5, $6, $7, NULLIF($8, '')::inet, $9, $10, $11::jsonb)
      `,
      [
        actor.tenantId,
        actor.userId,
        actor.sessionId,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        input.status,
        audit.ipAddress ?? "",
        audit.userAgent ?? null,
        audit.requestId,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  }

  private async loadOwners(client: PoolClient, tenantId: string) {
    const result = await client.query<UserLookupRow>(
      `
        SELECT
          users.id,
          users.display_name,
          users.email,
          teams.name AS team_name,
          departments.name AS department_name
        FROM users
        LEFT JOIN teams
          ON teams.id = users.team_id
         AND teams.tenant_id = users.tenant_id
         AND teams.deleted_at IS NULL
        LEFT JOIN departments
          ON departments.id = users.department_id
         AND departments.tenant_id = users.tenant_id
         AND departments.deleted_at IS NULL
        WHERE users.tenant_id = $1
          AND users.deleted_at IS NULL
          AND users.status IN ('active', 'invited')
        ORDER BY users.display_name ASC
      `,
      [tenantId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      teamName: row.team_name,
      departmentName: row.department_name
    }));
  }

  private async loadOptionSetValues(client: PoolClient, tenantId: string, setKey: string) {
    const result = await client.query<OptionValueRow>(
      `
        SELECT
          tenant_option_values.id,
          tenant_option_values.value_key AS key,
          tenant_option_values.label,
          tenant_option_values.description,
          tenant_option_values.color,
          tenant_option_values.is_default,
          tenant_option_values.is_active
        FROM tenant_option_sets
        INNER JOIN tenant_option_values
          ON tenant_option_values.option_set_id = tenant_option_sets.id
         AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1
          AND tenant_option_sets.set_key = $2
          AND tenant_option_sets.deleted_at IS NULL
          AND tenant_option_values.deleted_at IS NULL
        ORDER BY tenant_option_values.sort_order ASC, tenant_option_values.label ASC
      `,
      [tenantId, setKey]
    );

    return result.rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      description: row.description,
      color: row.color,
      isDefault: row.is_default,
      isActive: row.is_active
    }));
  }

  private async resolveOptionValueId(
    client: PoolClient,
    tenantId: string,
    setKey: string,
    valueKey: string,
    label: string
  ) {
    const result = await client.query<{ id: string }>(
      `
        SELECT tenant_option_values.id
        FROM tenant_option_sets
        INNER JOIN tenant_option_values
          ON tenant_option_values.option_set_id = tenant_option_sets.id
         AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1
          AND tenant_option_sets.set_key = $2
          AND tenant_option_sets.deleted_at IS NULL
          AND tenant_option_values.deleted_at IS NULL
          AND tenant_option_values.is_active = true
          AND tenant_option_values.value_key = $3
        LIMIT 1
      `,
      [tenantId, setKey, valueKey.trim()]
    );

    const optionValueId = result.rows[0]?.id;

    if (!optionValueId) {
      throw new AppError(400, `${label} is invalid for this tenant.`, undefined, "INVALID_OPTION_VALUE");
    }

    return optionValueId;
  }

  private async resolveChannelOptionIds(client: PoolClient, tenantId: string, channelKeys: string[]) {
    const normalizedKeys = Array.from(
      new Set(
        channelKeys
          .map((channelKey) => channelKey.trim())
          .filter((channelKey) => channelKey.length > 0)
      )
    );

    if (normalizedKeys.length === 0) {
      throw new AppError(400, "At least one social channel must be selected.", undefined, "VALIDATION_ERROR");
    }

    const result = await client.query<{ id: string; value_key: string }>(
      `
        SELECT tenant_option_values.id, tenant_option_values.value_key
        FROM tenant_option_sets
        INNER JOIN tenant_option_values
          ON tenant_option_values.option_set_id = tenant_option_sets.id
         AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1
          AND tenant_option_sets.set_key = 'social-channel'
          AND tenant_option_sets.deleted_at IS NULL
          AND tenant_option_values.deleted_at IS NULL
          AND tenant_option_values.is_active = true
          AND tenant_option_values.value_key = ANY($2::text[])
      `,
      [tenantId, normalizedKeys]
    );

    if (result.rows.length !== normalizedKeys.length) {
      throw new AppError(400, "One or more social channels are invalid for this tenant.", undefined, "INVALID_OPTION_VALUE");
    }

    const idByKey = new Map(result.rows.map((row) => [row.value_key, row.id]));
    return normalizedKeys.map((channelKey) => idByKey.get(channelKey) as string);
  }

  private async ensureOwnerId(client: PoolClient, tenantId: string, ownerId: string | null | undefined) {
    if (!ownerId) {
      return null;
    }

    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM users
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
          AND status IN ('active', 'invited')
        LIMIT 1
      `,
      [ownerId, tenantId]
    );

    const resolvedOwnerId = result.rows[0]?.id ?? null;

    if (!resolvedOwnerId) {
      throw new AppError(400, "The selected owner is invalid for this tenant.", undefined, "INVALID_OWNER");
    }

    return resolvedOwnerId;
  }

  private async ensureCampaignId(client: PoolClient, tenantId: string, campaignId: string | null | undefined) {
    if (!campaignId) {
      return null;
    }

    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM campaigns
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [campaignId, tenantId]
    );

    const resolvedCampaignId = result.rows[0]?.id ?? null;

    if (!resolvedCampaignId) {
      throw new AppError(400, "The selected campaign is invalid for this tenant.", undefined, "INVALID_CAMPAIGN_LINK");
    }

    return resolvedCampaignId;
  }

  private assertSocialMutation(actor: ActorContext, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit = actor.permissionCodes.includes("social.edit");
    const canConfigure = actor.permissionCodes.includes("social.configure");
    const canAssign = actor.permissionCodes.includes("social.assign");
    const canApprove = actor.permissionCodes.includes("social.approve");
    const isAssignOnlyMutation = keys.every((key) => key === "ownerId" || key === "campaignId");
    const isApproveOnlyMutation = keys.every((key) => key === "approvalStatusKey");

    if (!canEdit && !canConfigure && !(canAssign && isAssignOnlyMutation) && !(canApprove && isApproveOnlyMutation)) {
      throw new AppError(
        403,
        "You do not have permission to update these social post fields.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }
  }

  private async getSocialPostState(client: PoolClient, tenantId: string, postId: string) {
    const result = await client.query<SocialPostStateRow>(
      `
        SELECT
          id,
          title,
          caption,
          creative_brief,
          hashtags,
          scheduled_at,
          owner_id,
          campaign_id,
          status_option_id,
          approval_status_option_id,
          metadata
        FROM social_posts
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [postId, tenantId]
    );

    const post = result.rows[0] ?? null;

    if (!post) {
      throw new AppError(404, "Social post not found.", undefined, "SOCIAL_POST_NOT_FOUND");
    }

    return post;
  }

  private async loadCampaignLookups(client: PoolClient, tenantId: string): Promise<SocialLinkedCampaignSummary[]> {
    const result = await client.query<CampaignLookupRow>(
      `
        SELECT
          campaigns.id,
          campaigns.name,
          status_values.id AS status_id,
          status_values.value_key AS status_key,
          status_values.label AS status_label,
          status_values.description AS status_description,
          status_values.color AS status_color,
          status_values.is_default AS status_is_default,
          status_values.is_active AS status_is_active
        FROM campaigns
        LEFT JOIN tenant_option_values AS status_values
          ON status_values.id = campaigns.status_option_id
         AND status_values.tenant_id = campaigns.tenant_id
        WHERE campaigns.tenant_id = $1
          AND campaigns.deleted_at IS NULL
        ORDER BY campaigns.name ASC
      `,
      [tenantId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: mapOptionValue({
        id: row.status_id,
        key: row.status_key,
        label: row.status_label,
        description: row.status_description,
        color: row.status_color,
        isDefault: row.status_is_default,
        isActive: row.status_is_active
      })
    }));
  }

  private async loadChannelsForPosts(client: PoolClient, tenantId: string, postIds: string[]) {
    const channelsByPostId = new Map<string, CrmOptionValueSummary[]>();

    if (postIds.length === 0) {
      return channelsByPostId;
    }

    const result = await client.query<SocialChannelRow>(
      `
        SELECT
          social_post_channels.social_post_id,
          tenant_option_values.id,
          tenant_option_values.value_key AS key,
          tenant_option_values.label,
          tenant_option_values.description,
          tenant_option_values.color,
          tenant_option_values.is_default,
          tenant_option_values.is_active
        FROM social_post_channels
        INNER JOIN tenant_option_values
          ON tenant_option_values.id = social_post_channels.channel_option_id
         AND tenant_option_values.tenant_id = social_post_channels.tenant_id
        WHERE social_post_channels.tenant_id = $1
          AND social_post_channels.social_post_id = ANY($2::uuid[])
          AND social_post_channels.deleted_at IS NULL
          AND tenant_option_values.deleted_at IS NULL
        ORDER BY tenant_option_values.label ASC
      `,
      [tenantId, postIds]
    );

    for (const row of result.rows) {
      const existing = channelsByPostId.get(row.social_post_id) ?? [];
      existing.push({
        id: row.id,
        key: row.key,
        label: row.label,
        description: row.description,
        color: row.color,
        isDefault: row.is_default,
        isActive: row.is_active
      });
      channelsByPostId.set(row.social_post_id, existing);
    }

    return channelsByPostId;
  }

  private async syncPostChannels(
    client: PoolClient,
    actor: ActorContext,
    postId: string,
    channelOptionIds: string[]
  ) {
    await client.query(
      `
        UPDATE social_post_channels
        SET
          deleted_at = NOW(),
          updated_by = $4
        WHERE tenant_id = $1
          AND social_post_id = $2
          AND deleted_at IS NULL
          AND channel_option_id <> ALL($3::uuid[])
      `,
      [actor.tenantId, postId, channelOptionIds, actor.userId]
    );

    await client.query(
      `
        UPDATE social_post_channels
        SET
          deleted_at = NULL,
          updated_by = $4
        WHERE id IN (
          SELECT DISTINCT ON (channel_option_id) id
          FROM social_post_channels
          WHERE tenant_id = $1
            AND social_post_id = $2
            AND channel_option_id = ANY($3::uuid[])
            AND deleted_at IS NOT NULL
          ORDER BY channel_option_id, updated_at DESC
        )
      `,
      [actor.tenantId, postId, channelOptionIds, actor.userId]
    );

    await client.query(
      `
        INSERT INTO social_post_channels (
          tenant_id,
          social_post_id,
          channel_option_id,
          metadata,
          created_by,
          updated_by
        )
        SELECT
          $1,
          $2,
          channel_id,
          '{}'::jsonb,
          $4,
          $4
        FROM unnest($3::uuid[]) AS channel_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM social_post_channels
          WHERE tenant_id = $1
            AND social_post_id = $2
            AND channel_option_id = channel_id
        )
      `,
      [actor.tenantId, postId, channelOptionIds, actor.userId]
    );
  }

  private mapSocialPost(row: SocialPostRecordRow, channels: CrmOptionValueSummary[]): SocialPostSummary {
    return {
      id: row.id,
      title: row.title,
      caption: row.caption,
      creativeBrief: row.creative_brief,
      hashtags: normalizeHashtags(row.hashtags),
      scheduledAt: toIsoString(row.scheduled_at),
      status: mapOptionValue({
        id: row.status_id,
        key: row.status_key,
        label: row.status_label,
        description: row.status_description,
        color: row.status_color,
        isDefault: row.status_is_default,
        isActive: row.status_is_active
      }),
      approvalStatus: mapOptionValue({
        id: row.approval_status_id,
        key: row.approval_status_key,
        label: row.approval_status_label,
        description: row.approval_status_description,
        color: row.approval_status_color,
        isDefault: row.approval_status_is_default,
        isActive: row.approval_status_is_active
      }),
      channels,
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
      }),
      campaign: buildCampaignLink(row),
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private buildAiPlaceholders(actor: ActorContext) {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi =
      permissionCodes.has("social.use_ai") ||
      permissionCodes.has("social.manage_ai") ||
      permissionCodes.has("ai.use_ai") ||
      permissionCodes.has("ai.manage_ai");
    const canManageAi = permissionCodes.has("social.manage_ai") || permissionCodes.has("ai.manage_ai");

    return {
      actions: canUseAi
        ? [
            {
              key: "generate_caption" as const,
              label: "Generate caption",
              description: "Placeholder entry point for future caption drafting with channel-aware tone guidance."
            },
            {
              key: "suggest_hashtags" as const,
              label: "Suggest hashtags",
              description: "Placeholder entry point for future hashtag recommendations based on campaign context."
            },
            {
              key: "generate_creative_brief" as const,
              label: "Generate creative brief",
              description: "Placeholder entry point for future creative concept and asset briefing assistance."
            },
            {
              key: "summarize_engagement" as const,
              label: "Summarize engagement",
              description: "Placeholder entry point for future engagement recap and performance narration."
            },
            {
              key: "detect_lead_intent" as const,
              label: "Detect lead intent",
              description: "Placeholder entry point for future social-response qualification and routing."
            }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with social-workflow controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution is intentionally deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes social or global AI usage permissions."
    };
  }

  private async loadSocialPostDetail(client: PoolClient, actor: ActorContext, postId: string): Promise<SocialPostDetail> {
    const result = await client.query<SocialPostRecordRow>(
      `
        SELECT
          social_posts.id,
          social_posts.title,
          social_posts.caption,
          social_posts.creative_brief,
          social_posts.hashtags,
          social_posts.scheduled_at,
          social_posts.metadata,
          social_posts.created_at,
          social_posts.updated_at,
          owner_users.id AS owner_id,
          owner_users.display_name AS owner_display_name,
          owner_users.email AS owner_email,
          owner_teams.name AS owner_team_name,
          owner_departments.name AS owner_department_name,
          campaigns.id AS campaign_id,
          campaigns.name AS campaign_name,
          campaign_status_values.id AS campaign_status_id,
          campaign_status_values.value_key AS campaign_status_key,
          campaign_status_values.label AS campaign_status_label,
          campaign_status_values.description AS campaign_status_description,
          campaign_status_values.color AS campaign_status_color,
          campaign_status_values.is_default AS campaign_status_is_default,
          campaign_status_values.is_active AS campaign_status_is_active,
          status_values.id AS status_id,
          status_values.value_key AS status_key,
          status_values.label AS status_label,
          status_values.description AS status_description,
          status_values.color AS status_color,
          status_values.is_default AS status_is_default,
          status_values.is_active AS status_is_active,
          approval_values.id AS approval_status_id,
          approval_values.value_key AS approval_status_key,
          approval_values.label AS approval_status_label,
          approval_values.description AS approval_status_description,
          approval_values.color AS approval_status_color,
          approval_values.is_default AS approval_status_is_default,
          approval_values.is_active AS approval_status_is_active
        FROM social_posts
        INNER JOIN tenant_option_values AS status_values
          ON status_values.id = social_posts.status_option_id
         AND status_values.tenant_id = social_posts.tenant_id
        INNER JOIN tenant_option_values AS approval_values
          ON approval_values.id = social_posts.approval_status_option_id
         AND approval_values.tenant_id = social_posts.tenant_id
        LEFT JOIN users AS owner_users
          ON owner_users.id = social_posts.owner_id
         AND owner_users.tenant_id = social_posts.tenant_id
         AND owner_users.deleted_at IS NULL
        LEFT JOIN teams AS owner_teams
          ON owner_teams.id = owner_users.team_id
         AND owner_teams.tenant_id = owner_users.tenant_id
         AND owner_teams.deleted_at IS NULL
        LEFT JOIN departments AS owner_departments
          ON owner_departments.id = owner_users.department_id
         AND owner_departments.tenant_id = owner_users.tenant_id
         AND owner_departments.deleted_at IS NULL
        LEFT JOIN campaigns
          ON campaigns.id = social_posts.campaign_id
         AND campaigns.tenant_id = social_posts.tenant_id
         AND campaigns.deleted_at IS NULL
        LEFT JOIN tenant_option_values AS campaign_status_values
          ON campaign_status_values.id = campaigns.status_option_id
         AND campaign_status_values.tenant_id = campaigns.tenant_id
        WHERE social_posts.tenant_id = $1
          AND social_posts.id = $2
          AND social_posts.deleted_at IS NULL
        LIMIT 1
      `,
      [actor.tenantId, postId]
    );

    const row = result.rows[0] ?? null;

    if (!row) {
      throw new AppError(404, "Social post not found.", undefined, "SOCIAL_POST_NOT_FOUND");
    }

    const channelsByPostId = await this.loadChannelsForPosts(client, actor.tenantId, [postId]);
    const channels = channelsByPostId.get(postId) ?? [];

    return {
      ...this.mapSocialPost(row, channels),
      engagementPlaceholder: {
        impressions: null,
        reactions: null,
        comments: null,
        shares: null,
        clicks: null,
        message: "Live engagement aggregation will connect in a later publishing and analytics phase."
      },
      leadCapturePlaceholder: {
        available: false,
        message: "Social lead capture will connect once response ingestion and qualification workflows are implemented."
      },
      listeningPlaceholder: {
        available: false,
        message: "Social listening will connect in a later monitoring phase with mention and sentiment ingestion."
      },
      competitorTrackingPlaceholder: {
        available: false,
        message: "Competitor tracking will connect once benchmark ingestion and alerting are implemented."
      },
      aiPlaceholders: this.buildAiPlaceholders(actor)
    };
  }

  async getSocialChannels(actor: ActorContext): Promise<SocialChannelsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      channels: await this.loadOptionSetValues(client, actor.tenantId, "social-channel")
    }));
  }

  async getSocialOptions(actor: ActorContext): Promise<SocialOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      campaigns: await this.loadCampaignLookups(client, actor.tenantId),
      statuses: await this.loadOptionSetValues(client, actor.tenantId, "social-post-status"),
      approvalStatuses: await this.loadOptionSetValues(client, actor.tenantId, "social-approval-status"),
      channels: await this.loadOptionSetValues(client, actor.tenantId, "social-channel")
    }));
  }

  async listSocialPosts(actor: ActorContext, query: SocialPostListQuery): Promise<SocialPostsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const page = getPositiveNumber(query.page, 1, 10_000);
      const pageSize = getPositiveNumber(query.pageSize, 12, 100);
      const offset = (page - 1) * pageSize;
      const conditions = ["social_posts.tenant_id = $1", "social_posts.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];

      if (query.search?.trim()) {
        params.push(`%${query.search.trim()}%`);
        const searchIndex = params.length;
        conditions.push(
          `(social_posts.title ILIKE $${searchIndex} OR COALESCE(social_posts.caption, '') ILIKE $${searchIndex} OR COALESCE(social_posts.creative_brief, '') ILIKE $${searchIndex} OR social_posts.hashtags::text ILIKE $${searchIndex})`
        );
      }

      if (query.status) {
        params.push(query.status.trim());
        conditions.push(`status_values.value_key = $${params.length}`);
      }

      if (query.approvalStatus) {
        params.push(query.approvalStatus.trim());
        conditions.push(`approval_values.value_key = $${params.length}`);
      }

      if (query.ownerId) {
        params.push(query.ownerId);
        conditions.push(`social_posts.owner_id = $${params.length}`);
      }

      if (query.campaignId) {
        params.push(query.campaignId);
        conditions.push(`social_posts.campaign_id = $${params.length}`);
      }

      if (query.channel) {
        params.push(query.channel.trim());
        conditions.push(`
          EXISTS (
            SELECT 1
            FROM social_post_channels AS filter_channels
            INNER JOIN tenant_option_values AS filter_channel_values
              ON filter_channel_values.id = filter_channels.channel_option_id
             AND filter_channel_values.tenant_id = filter_channels.tenant_id
            WHERE filter_channels.tenant_id = social_posts.tenant_id
              AND filter_channels.social_post_id = social_posts.id
              AND filter_channels.deleted_at IS NULL
              AND filter_channel_values.deleted_at IS NULL
              AND filter_channel_values.value_key = $${params.length}
          )
        `);
      }

      if (query.scheduledFrom) {
        params.push(query.scheduledFrom);
        conditions.push(`social_posts.scheduled_at >= $${params.length}::timestamptz`);
      }

      if (query.scheduledTo) {
        params.push(query.scheduledTo);
        conditions.push(`social_posts.scheduled_at <= $${params.length}::timestamptz`);
      }

      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*)::int AS total
          FROM social_posts
          INNER JOIN tenant_option_values AS status_values
            ON status_values.id = social_posts.status_option_id
           AND status_values.tenant_id = social_posts.tenant_id
          INNER JOIN tenant_option_values AS approval_values
            ON approval_values.id = social_posts.approval_status_option_id
           AND approval_values.tenant_id = social_posts.tenant_id
          WHERE ${whereClause}
        `,
        params
      );

      const total = countResult.rows[0]?.total ?? 0;
      const sortColumnByKey = {
        createdAt: "social_posts.created_at",
        updatedAt: "social_posts.updated_at",
        title: "social_posts.title",
        scheduledAt: "social_posts.scheduled_at",
        status: "status_values.label",
        approvalStatus: "approval_values.label",
        campaign: "COALESCE(campaigns.name, '')",
        owner: "COALESCE(owner_users.display_name, '')"
      } as const;
      const sortKey = (query.sortBy ?? "scheduledAt") as keyof typeof sortColumnByKey;
      const sortColumn = sortColumnByKey[sortKey];
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      params.push(pageSize, offset);

      const result = await client.query<SocialPostRecordRow>(
        `
          SELECT
            social_posts.id,
            social_posts.title,
            social_posts.caption,
            social_posts.creative_brief,
            social_posts.hashtags,
            social_posts.scheduled_at,
            social_posts.metadata,
            social_posts.created_at,
            social_posts.updated_at,
            owner_users.id AS owner_id,
            owner_users.display_name AS owner_display_name,
            owner_users.email AS owner_email,
            owner_teams.name AS owner_team_name,
            owner_departments.name AS owner_department_name,
            campaigns.id AS campaign_id,
            campaigns.name AS campaign_name,
            campaign_status_values.id AS campaign_status_id,
            campaign_status_values.value_key AS campaign_status_key,
            campaign_status_values.label AS campaign_status_label,
            campaign_status_values.description AS campaign_status_description,
            campaign_status_values.color AS campaign_status_color,
            campaign_status_values.is_default AS campaign_status_is_default,
            campaign_status_values.is_active AS campaign_status_is_active,
            status_values.id AS status_id,
            status_values.value_key AS status_key,
            status_values.label AS status_label,
            status_values.description AS status_description,
            status_values.color AS status_color,
            status_values.is_default AS status_is_default,
            status_values.is_active AS status_is_active,
            approval_values.id AS approval_status_id,
            approval_values.value_key AS approval_status_key,
            approval_values.label AS approval_status_label,
            approval_values.description AS approval_status_description,
            approval_values.color AS approval_status_color,
            approval_values.is_default AS approval_status_is_default,
            approval_values.is_active AS approval_status_is_active
          FROM social_posts
          INNER JOIN tenant_option_values AS status_values
            ON status_values.id = social_posts.status_option_id
           AND status_values.tenant_id = social_posts.tenant_id
          INNER JOIN tenant_option_values AS approval_values
            ON approval_values.id = social_posts.approval_status_option_id
           AND approval_values.tenant_id = social_posts.tenant_id
          LEFT JOIN users AS owner_users
            ON owner_users.id = social_posts.owner_id
           AND owner_users.tenant_id = social_posts.tenant_id
           AND owner_users.deleted_at IS NULL
          LEFT JOIN teams AS owner_teams
            ON owner_teams.id = owner_users.team_id
           AND owner_teams.tenant_id = owner_users.tenant_id
           AND owner_teams.deleted_at IS NULL
          LEFT JOIN departments AS owner_departments
            ON owner_departments.id = owner_users.department_id
           AND owner_departments.tenant_id = owner_users.tenant_id
           AND owner_departments.deleted_at IS NULL
          LEFT JOIN campaigns
            ON campaigns.id = social_posts.campaign_id
           AND campaigns.tenant_id = social_posts.tenant_id
           AND campaigns.deleted_at IS NULL
          LEFT JOIN tenant_option_values AS campaign_status_values
            ON campaign_status_values.id = campaigns.status_option_id
           AND campaign_status_values.tenant_id = campaigns.tenant_id
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, social_posts.created_at DESC
          LIMIT $${params.length - 1}
          OFFSET $${params.length}
        `,
        params
      );

      const postIds = result.rows.map((row) => row.id);
      const channelsByPostId = await this.loadChannelsForPosts(client, actor.tenantId, postIds);

      return {
        posts: result.rows.map((row) => this.mapSocialPost(row, channelsByPostId.get(row.id) ?? [])),
        pagination: getPagination(total, page, pageSize)
      };
    });
  }

  async getSocialPost(actor: ActorContext, postId: string): Promise<SocialPostResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      post: await this.loadSocialPostDetail(client, actor, postId)
    }));
  }

  async createSocialPost(
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreateSocialPostRequestBody
  ): Promise<SocialPostResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null);
      const campaignId = await this.ensureCampaignId(client, actor.tenantId, input.campaignId ?? null);
      const statusOptionId = await this.resolveOptionValueId(client, actor.tenantId, "social-post-status", input.statusKey, "Social post status");
      const approvalStatusOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "social-approval-status",
        input.approvalStatusKey,
        "Social approval status"
      );
      const channelOptionIds = await this.resolveChannelOptionIds(client, actor.tenantId, input.channelKeys);

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO social_posts (
            tenant_id,
            campaign_id,
            owner_id,
            title,
            caption,
            creative_brief,
            hashtags,
            scheduled_at,
            status_option_id,
            approval_status_option_id,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11::jsonb, $12, $12)
          RETURNING id
        `,
        [
          actor.tenantId,
          campaignId,
          ownerId,
          input.title.trim(),
          getTrimmedNullableString(input.caption),
          getTrimmedNullableString(input.creativeBrief),
          JSON.stringify(normalizeHashtags(input.hashtags)),
          input.scheduledAt ?? null,
          statusOptionId,
          approvalStatusOptionId,
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const postId = result.rows[0]?.id;

      if (!postId) {
        throw new AppError(500, "Social post creation failed.", undefined, "SOCIAL_POST_CREATE_FAILED");
      }

      await this.syncPostChannels(client, actor, postId, channelOptionIds);

      await this.recordAuditLog(client, actor, audit, {
        action: "social.create",
        resourceType: "social_post",
        resourceId: postId,
        status: "success",
        metadata: {
          statusKey: input.statusKey,
          approvalStatusKey: input.approvalStatusKey,
          campaignId,
          ownerId,
          channelKeys: input.channelKeys
        }
      });

      return {
        post: await this.loadSocialPostDetail(client, actor, postId)
      };
    });
  }

  async updateSocialPost(
    actor: ActorContext,
    audit: AuditMetadata,
    postId: string,
    input: UpdateSocialPostRequestBody
  ): Promise<SocialPostResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateSocialPostRequestBody] !== undefined);
      this.assertSocialMutation(actor, keys);

      const currentPost = await this.getSocialPostState(client, actor.tenantId, postId);
      const ownerId = keys.includes("ownerId")
        ? await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null)
        : currentPost.owner_id;
      const campaignId = keys.includes("campaignId")
        ? await this.ensureCampaignId(client, actor.tenantId, input.campaignId ?? null)
        : currentPost.campaign_id;
      const statusOptionId = input.statusKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "social-post-status", input.statusKey, "Social post status")
        : currentPost.status_option_id;
      const approvalStatusOptionId = input.approvalStatusKey
        ? await this.resolveOptionValueId(
            client,
            actor.tenantId,
            "social-approval-status",
            input.approvalStatusKey,
            "Social approval status"
          )
        : currentPost.approval_status_option_id;
      const metadata = input.metadata
        ? { ...getMetadata(currentPost.metadata), ...input.metadata }
        : getMetadata(currentPost.metadata);
      const hashtags = input.hashtags !== undefined
        ? normalizeHashtags(input.hashtags)
        : normalizeHashtags(currentPost.hashtags);

      await client.query(
        `
          UPDATE social_posts
          SET
            campaign_id = $3,
            owner_id = $4,
            title = $5,
            caption = $6,
            creative_brief = $7,
            hashtags = $8::jsonb,
            scheduled_at = $9,
            status_option_id = $10,
            approval_status_option_id = $11,
            metadata = $12::jsonb,
            updated_by = $13
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [
          postId,
          actor.tenantId,
          campaignId,
          ownerId,
          input.title?.trim() ?? currentPost.title,
          input.caption !== undefined ? getTrimmedNullableString(input.caption) : currentPost.caption,
          input.creativeBrief !== undefined ? getTrimmedNullableString(input.creativeBrief) : currentPost.creative_brief,
          JSON.stringify(hashtags),
          input.scheduledAt !== undefined ? input.scheduledAt : toIsoString(currentPost.scheduled_at),
          statusOptionId,
          approvalStatusOptionId,
          JSON.stringify(metadata),
          actor.userId
        ]
      );

      if (input.channelKeys !== undefined) {
        const channelOptionIds = await this.resolveChannelOptionIds(client, actor.tenantId, input.channelKeys);
        await this.syncPostChannels(client, actor, postId, channelOptionIds);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "social.update",
        resourceType: "social_post",
        resourceId: postId,
        status: "success",
        metadata: {
          updatedFields: keys
        }
      });

      return {
        post: await this.loadSocialPostDetail(client, actor, postId)
      };
    });
  }

  async deleteSocialPost(actor: ActorContext, audit: AuditMetadata, postId: string): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getSocialPostState(client, actor.tenantId, postId);

      await client.query(
        `
          UPDATE social_posts
          SET
            deleted_at = NOW(),
            updated_by = $3
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [postId, actor.tenantId, actor.userId]
      );

      await client.query(
        `
          UPDATE social_post_channels
          SET
            deleted_at = NOW(),
            updated_by = $3
          WHERE tenant_id = $1
            AND social_post_id = $2
            AND deleted_at IS NULL
        `,
        [actor.tenantId, postId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "social.delete",
        resourceType: "social_post",
        resourceId: postId,
        status: "success"
      });

      return { success: true };
    });
  }
}
