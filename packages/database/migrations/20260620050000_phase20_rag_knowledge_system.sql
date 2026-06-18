-- migrate:up
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  source_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'product_documentation'
    CHECK (source_type IN (
      'product_documentation', 'user_guide', 'admin_guide', 'training_content',
      'faq', 'release_notes', 'support_article', 'resolved_ticket', 'customer_document'
    )),
  access_scope TEXT NOT NULL DEFAULT 'tenant'
    CHECK (access_scope IN ('tenant', 'restricted')),
  required_permission TEXT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT uniq_knowledge_sources_id_tenant UNIQUE (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_knowledge_sources_tenant_key ON knowledge_sources (tenant_id, source_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_tenant_type ON knowledge_sources (tenant_id, source_type) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  source_id UUID NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  content_format TEXT NOT NULL DEFAULT 'text'
    CHECK (content_format IN ('text', 'markdown', 'html')),
  source_uri TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'chunked', 'embedded')),
  chunk_count INTEGER NOT NULL DEFAULT 0,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT fk_knowledge_documents_source FOREIGN KEY (source_id, tenant_id) REFERENCES knowledge_sources (id, tenant_id),
  CONSTRAINT uniq_knowledge_documents_id_tenant UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant_source ON knowledge_documents (tenant_id, source_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant_status ON knowledge_documents (tenant_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  document_id UUID NOT NULL,
  source_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  embedding_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'placeholder', 'embedded')),
  embedding_model TEXT NOT NULL DEFAULT '',
  embedding_ref TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_knowledge_chunks_document FOREIGN KEY (document_id, tenant_id) REFERENCES knowledge_documents (id, tenant_id),
  CONSTRAINT uniq_knowledge_chunks_document_index UNIQUE (tenant_id, document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tenant_source ON knowledge_chunks (tenant_id, source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_content_search ON knowledge_chunks USING gin (to_tsvector('english', content));

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  article_key TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'archived')),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  current_version INTEGER NOT NULL DEFAULT 1,
  latest_version INTEGER NOT NULL DEFAULT 1,
  source_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT fk_knowledge_articles_source FOREIGN KEY (source_id, tenant_id) REFERENCES knowledge_sources (id, tenant_id),
  CONSTRAINT uniq_knowledge_articles_id_tenant UNIQUE (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_knowledge_articles_tenant_key ON knowledge_articles (tenant_id, article_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tenant_status ON knowledge_articles (tenant_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS knowledge_article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  article_id UUID NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  change_summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'archived')),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  CONSTRAINT fk_knowledge_article_versions_article FOREIGN KEY (article_id, tenant_id) REFERENCES knowledge_articles (id, tenant_id),
  CONSTRAINT uniq_knowledge_article_versions_version UNIQUE (tenant_id, article_id, version)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_article_versions_article ON knowledge_article_versions (tenant_id, article_id, version DESC);

CREATE TABLE IF NOT EXISTS knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  query_text TEXT NOT NULL,
  detected_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (detected_source IN ('retrieval', 'support', 'manual')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_note TEXT NOT NULL DEFAULT '',
  related_article_id UUID NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_tenant_status ON knowledge_gaps (tenant_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_knowledge_sources_updated_at BEFORE UPDATE ON knowledge_sources FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_knowledge_documents_updated_at BEFORE UPDATE ON knowledge_documents FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_knowledge_articles_updated_at BEFORE UPDATE ON knowledge_articles FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_knowledge_gaps_updated_at BEFORE UPDATE ON knowledge_gaps FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_knowledge_gaps_updated_at ON knowledge_gaps;
DROP TRIGGER IF EXISTS trg_knowledge_articles_updated_at ON knowledge_articles;
DROP TRIGGER IF EXISTS trg_knowledge_documents_updated_at ON knowledge_documents;
DROP TRIGGER IF EXISTS trg_knowledge_sources_updated_at ON knowledge_sources;
DROP TABLE IF EXISTS knowledge_gaps;
DROP TABLE IF EXISTS knowledge_article_versions;
DROP TABLE IF EXISTS knowledge_articles;
DROP TABLE IF EXISTS knowledge_chunks;
DROP TABLE IF EXISTS knowledge_documents;
DROP TABLE IF EXISTS knowledge_sources;
