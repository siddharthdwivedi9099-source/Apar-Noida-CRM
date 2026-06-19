# AI Use Case Catalog

## Purpose

This catalog lists the module-specific AI actions integrated across the CRM in Phase 22. Every action runs through the governed AI Gateway, resolves its prompt from the managed Prompt Registry (never hardcoded), checks permissions, logs its request and response, and — when sensitive — requires human review before use.

## How actions work

- **Catalog** — `GET /ai/actions` returns the action catalog (optionally `?module=`), each with a `permitted` flag derived from the caller's permissions.
- **Execute** — `POST /ai/actions/:actionKey/execute` runs the action: it checks the action's required permission, resolves the prompt template via the AI Gateway, executes (placeholder), and writes an `ai_action_runs` log row plus an `ai_usage_logs` entry.
- **Review** — sensitive actions return `requiresReview: true` with `review_status = pending_review`. A reviewer approves or rejects via `POST /ai/actions/runs/:runId/review`.
- **Observe** — `GET /ai/actions/runs` and `GET /ai/actions/runs/:runId` expose the logged runs (requires `ai.view`/`ai.view_dashboard`/`ai.manage_ai`/`ai.configure`/`ai.approve`).

Each action requires a module permission (`<module>.view`/`use_ai`/`manage_ai`/`configure`) or the cross-cutting `ai.use_ai`/`ai.manage_ai`. Reviewing a sensitive action requires `<module>.approve`/`manage_ai`/`configure` or `ai.approve`/`manage_ai`.

## Actions by module

Actions marked **(review)** are sensitive and require human review before the output is used.

### Leads
- Lead summary
- Lead score explanation
- Follow-up email draft **(review)**
- Lead qualification recommendation **(review)**

### Accounts
- Account brief
- Relationship summary
- Health indicator explanation

### Opportunities
- Opportunity summary
- Deal risk analysis
- Next-best-action **(review)**
- Proposal draft outline **(review)**

### Campaigns
- Campaign plan generator **(review)**
- Email copy generator **(review)**
- Audience suggestion **(review)**
- Campaign performance summary

### Social
- Caption generator **(review)**
- Hashtag suggestion
- Comment sentiment summary

### Support
- Ticket summary
- Suggested response **(review)**
- Knowledge article recommendation
- Escalation summary

### Customer Success
- Onboarding plan generator **(review)**
- Customer health summary
- Churn risk explanation
- Adoption recommendation **(review)**
- QBR/EBR outline **(review)**
- Renewal strategy suggestion **(review)**

### Training
- Lesson summary
- Quiz generator
- Learning path suggestion

### Partners
- Partner performance summary
- Partner action plan **(review)**
- Inactivity alert explanation

### Resellers
- Reseller performance summary
- Reseller action plan **(review)**
- Inactivity alert explanation

## Governance

See [AI_GOVERNANCE.md](./AI_GOVERNANCE.md) for the rules every action enforces and [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) for how the action layer composes the AI Gateway and Prompt Registry. Live model execution remains deferred; actions return governed placeholder output until providers are enabled.
