-- migrate:up
-- Section 16: extend the governed configuration-definition registry with the
-- journey definition type so the required revenue journeys (inbound, outbound,
-- partner, enterprise, renewal, expansion, support-led, campaign-led, CS-led,
-- AI-assisted) can be seeded, versioned, and edited as configuration. Additive.
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
      'validation_rule',
      'journey'
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
      'sla_policy',
      'validation_rule'
    )
  );
