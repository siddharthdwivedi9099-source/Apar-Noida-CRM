-- migrate:up
CREATE TABLE IF NOT EXISTS training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  owner_id UUID NULL,
  category_option_id UUID NOT NULL,
  level_option_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  estimated_minutes INTEGER NULL CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
  is_role_based BOOLEAN NOT NULL DEFAULT FALSE,
  target_role TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT training_programs_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT training_programs_owner_fk FOREIGN KEY (owner_id, tenant_id) REFERENCES users (id, tenant_id),
  CONSTRAINT training_programs_category_option_fk FOREIGN KEY (category_option_id, tenant_id) REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT training_programs_level_option_fk FOREIGN KEY (level_option_id, tenant_id) REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_training_programs_tenant_active ON training_programs (tenant_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_training_programs_tenant_category_active ON training_programs (tenant_id, category_option_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  program_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT training_modules_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT training_modules_program_fk FOREIGN KEY (program_id, tenant_id) REFERENCES training_programs (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_training_modules_tenant_program_active ON training_modules (tenant_id, program_id, sort_order ASC, created_at ASC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS training_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  program_id UUID NOT NULL,
  module_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NULL,
  lesson_type TEXT NOT NULL DEFAULT 'article' CHECK (lesson_type IN ('article', 'video', 'quiz', 'interactive')),
  duration_minutes INTEGER NULL CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT training_lessons_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT training_lessons_program_fk FOREIGN KEY (program_id, tenant_id) REFERENCES training_programs (id, tenant_id),
  CONSTRAINT training_lessons_module_fk FOREIGN KEY (module_id, tenant_id) REFERENCES training_modules (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_training_lessons_tenant_module_active ON training_lessons (tenant_id, module_id, sort_order ASC, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_training_lessons_tenant_program_active ON training_lessons (tenant_id, program_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS training_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  lesson_id UUID NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'link' CHECK (asset_type IN ('link', 'video', 'document', 'scorm')),
  url TEXT NULL,
  external_reference TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT training_assets_lesson_fk FOREIGN KEY (lesson_id, tenant_id) REFERENCES training_lessons (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_training_assets_tenant_lesson_active ON training_assets (tenant_id, lesson_id, created_at ASC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS customer_learners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  learner_type TEXT NOT NULL DEFAULT 'user' CHECK (learner_type IN ('user', 'contact')),
  user_id UUID NULL,
  contact_id UUID NULL,
  account_id UUID NULL,
  display_name TEXT NOT NULL,
  email TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT customer_learners_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT customer_learners_user_fk FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id),
  CONSTRAINT customer_learners_contact_fk FOREIGN KEY (contact_id, tenant_id) REFERENCES contacts (id, tenant_id),
  CONSTRAINT customer_learners_account_fk FOREIGN KEY (account_id, tenant_id) REFERENCES accounts (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_learners_tenant_active ON customer_learners (tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_learners_tenant_user_active ON customer_learners (tenant_id, user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS training_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  program_id UUID NOT NULL,
  assignee_type TEXT NOT NULL DEFAULT 'user' CHECK (assignee_type IN ('user', 'contact', 'account')),
  user_id UUID NULL,
  contact_id UUID NULL,
  account_id UUID NULL,
  cs_account_id UUID NULL,
  onboarding_plan_id UUID NULL,
  learner_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'expired')),
  completion_percent INTEGER NOT NULL DEFAULT 0 CHECK (completion_percent >= 0 AND completion_percent <= 100),
  due_date DATE NULL,
  completed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT training_assignments_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT training_assignments_program_fk FOREIGN KEY (program_id, tenant_id) REFERENCES training_programs (id, tenant_id),
  CONSTRAINT training_assignments_user_fk FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id),
  CONSTRAINT training_assignments_contact_fk FOREIGN KEY (contact_id, tenant_id) REFERENCES contacts (id, tenant_id),
  CONSTRAINT training_assignments_account_fk FOREIGN KEY (account_id, tenant_id) REFERENCES accounts (id, tenant_id),
  CONSTRAINT training_assignments_cs_account_fk FOREIGN KEY (cs_account_id, tenant_id) REFERENCES customer_success_accounts (id, tenant_id),
  CONSTRAINT training_assignments_onboarding_plan_fk FOREIGN KEY (onboarding_plan_id, tenant_id) REFERENCES onboarding_plans (id, tenant_id),
  CONSTRAINT training_assignments_learner_fk FOREIGN KEY (learner_id, tenant_id) REFERENCES customer_learners (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_training_assignments_tenant_active ON training_assignments (tenant_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_training_assignments_tenant_user_active ON training_assignments (tenant_id, user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_training_assignments_tenant_program_active ON training_assignments (tenant_id, program_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_training_assignments_tenant_cs_account_active ON training_assignments (tenant_id, cs_account_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  assignment_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  learner_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT training_progress_assignment_fk FOREIGN KEY (assignment_id, tenant_id) REFERENCES training_assignments (id, tenant_id),
  CONSTRAINT training_progress_lesson_fk FOREIGN KEY (lesson_id, tenant_id) REFERENCES training_lessons (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_training_progress_active ON training_progress (assignment_id, lesson_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_training_progress_tenant_assignment_active ON training_progress (tenant_id, assignment_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS training_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  program_id UUID NULL,
  lesson_id UUID NULL,
  assignment_id UUID NULL,
  learner_id UUID NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT training_feedback_program_fk FOREIGN KEY (program_id, tenant_id) REFERENCES training_programs (id, tenant_id),
  CONSTRAINT training_feedback_lesson_fk FOREIGN KEY (lesson_id, tenant_id) REFERENCES training_lessons (id, tenant_id),
  CONSTRAINT training_feedback_assignment_fk FOREIGN KEY (assignment_id, tenant_id) REFERENCES training_assignments (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_training_feedback_tenant_program_active ON training_feedback (tenant_id, program_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_training_feedback_tenant_assignment_active ON training_feedback (tenant_id, assignment_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS training_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  program_id UUID NOT NULL,
  learner_id UUID NULL,
  assignment_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'earned', 'expired')),
  earned_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  certificate_reference TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT training_certifications_program_fk FOREIGN KEY (program_id, tenant_id) REFERENCES training_programs (id, tenant_id),
  CONSTRAINT training_certifications_assignment_fk FOREIGN KEY (assignment_id, tenant_id) REFERENCES training_assignments (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_training_certifications_tenant_program_active ON training_certifications (tenant_id, program_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_training_programs_updated_at BEFORE UPDATE ON training_programs FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_training_modules_updated_at BEFORE UPDATE ON training_modules FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_training_lessons_updated_at BEFORE UPDATE ON training_lessons FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_training_assets_updated_at BEFORE UPDATE ON training_assets FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_customer_learners_updated_at BEFORE UPDATE ON customer_learners FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_training_assignments_updated_at BEFORE UPDATE ON training_assignments FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_training_progress_updated_at BEFORE UPDATE ON training_progress FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_training_feedback_updated_at BEFORE UPDATE ON training_feedback FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_training_certifications_updated_at BEFORE UPDATE ON training_certifications FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_training_certifications_updated_at ON training_certifications;
DROP TRIGGER IF EXISTS trg_training_feedback_updated_at ON training_feedback;
DROP TRIGGER IF EXISTS trg_training_progress_updated_at ON training_progress;
DROP TRIGGER IF EXISTS trg_training_assignments_updated_at ON training_assignments;
DROP TRIGGER IF EXISTS trg_customer_learners_updated_at ON customer_learners;
DROP TRIGGER IF EXISTS trg_training_assets_updated_at ON training_assets;
DROP TRIGGER IF EXISTS trg_training_lessons_updated_at ON training_lessons;
DROP TRIGGER IF EXISTS trg_training_modules_updated_at ON training_modules;
DROP TRIGGER IF EXISTS trg_training_programs_updated_at ON training_programs;

DROP TABLE IF EXISTS training_certifications;
DROP TABLE IF EXISTS training_feedback;
DROP TABLE IF EXISTS training_progress;
DROP TABLE IF EXISTS training_assignments;
DROP TABLE IF EXISTS customer_learners;
DROP TABLE IF EXISTS training_assets;
DROP TABLE IF EXISTS training_lessons;
DROP TABLE IF EXISTS training_modules;
DROP TABLE IF EXISTS training_programs;
