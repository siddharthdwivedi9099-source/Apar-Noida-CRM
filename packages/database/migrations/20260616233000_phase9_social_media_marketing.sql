-- migrate:up
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  campaign_id UUID NULL,
  owner_id UUID NULL,
  title TEXT NOT NULL,
  caption TEXT NULL,
  creative_brief TEXT NULL,
  hashtags JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(hashtags) = 'array'),
  scheduled_at TIMESTAMPTZ NULL,
  status_option_id UUID NOT NULL,
  approval_status_option_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT social_posts_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT social_posts_campaign_fk
    FOREIGN KEY (campaign_id, tenant_id)
    REFERENCES campaigns (id, tenant_id),
  CONSTRAINT social_posts_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT social_posts_status_option_fk
    FOREIGN KEY (status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT social_posts_approval_status_option_fk
    FOREIGN KEY (approval_status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_active
  ON social_posts (tenant_id, scheduled_at ASC, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_owner_active
  ON social_posts (tenant_id, owner_id, scheduled_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_campaign_active
  ON social_posts (tenant_id, campaign_id, scheduled_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_status_active
  ON social_posts (tenant_id, status_option_id, approval_status_option_id, scheduled_at ASC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS social_post_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  social_post_id UUID NOT NULL,
  channel_option_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT social_post_channels_post_fk
    FOREIGN KEY (social_post_id, tenant_id)
    REFERENCES social_posts (id, tenant_id),
  CONSTRAINT social_post_channels_channel_option_fk
    FOREIGN KEY (channel_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_social_post_channels_active
  ON social_post_channels (social_post_id, channel_option_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_post_channels_tenant_post_active
  ON social_post_channels (tenant_id, social_post_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_post_channels_tenant_channel_active
  ON social_post_channels (tenant_id, channel_option_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_social_post_channels_updated_at
  BEFORE UPDATE ON social_post_channels
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_social_post_channels_updated_at ON social_post_channels;
DROP TRIGGER IF EXISTS trg_social_posts_updated_at ON social_posts;

DROP TABLE IF EXISTS social_post_channels;
DROP TABLE IF EXISTS social_posts;
