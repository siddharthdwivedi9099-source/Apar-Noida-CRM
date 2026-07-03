-- migrate:up
-- Section 13: extend the governed configuration-definition registry with the
-- validation_rule definition type so the required lifecycle validation rules
-- can be seeded, versioned, and edited as configuration. Additive only.
ALTER TABLE configuration_definitions
  DROP CONSTRAINT IF EXISTS configuration_definitions_definition_type_check;

ALTER TABLE configuration_definitions
  ADD CONSTRAINT configuration_definitions_definition_type_check CHECK (
    definition_type IN (
      'module_meta',
      'object',
      'page_layout',
      'business_process_flow',
      'approval_matrix',
      'notification_rule',
      'dashboard',
      'persona',
      'access_policy',
      'scoring_model',
      'mql_rule',
      'assignment_rule',
      'sla_policy',
      'validation_rule'
    )
  );

-- migrate:down
ALTER TABLE configuration_definitions
  DROP CONSTRAINT IF EXISTS configuration_definitions_definition_type_check;

ALTER TABLE configuration_definitions
  ADD CONSTRAINT configuration_definitions_definition_type_check CHECK (
    definition_type IN (
      'module_meta',
      'object',
      'page_layout',
      'business_process_flow',
      'approval_matrix',
      'notification_rule',
      'dashboard',
      'persona',
      'access_policy',
      'scoring_model',
      'mql_rule',
      'assignment_rule',
      'sla_policy'
    )
  );
