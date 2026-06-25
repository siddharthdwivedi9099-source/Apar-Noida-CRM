-- migrate:up
-- Extend the governed configuration-definition registry to include persona
-- access profiles and permission policies. Additive: no data is removed.
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
      'access_policy'
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
      'dashboard'
    )
  );
