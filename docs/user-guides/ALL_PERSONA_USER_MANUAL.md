# AI-Native CRM — Full Persona User Manual

This manual describes the major user personas supported by the CRM platform and explains the key workflows, capabilities, and governance responsibilities for each persona.

> The exact screens, labels, and available modules depend on your tenant configuration and role permissions. If a section references a page that does not appear, your tenant may have that module disabled or your role may not grant access.

---

## Demo logins

A demo login exists for every canonical role. Use the shared demo password in your environment, or refer to `docs/user-guides/DEMO_LOGINS.md` for the exact seeded email list.

- Tenant: `sample-tenant`
- Common demo password: `Demo@1234`
- Super Admin: `super.admin@sample-tenant.local`
- CRM Admin: `crm.admin@sample-tenant.local`
- Customer Portal User: `customer.portal.user@sample-tenant.local`

---

## 1. Platform / Super Admin

**Who you are:** the highest-privilege administrator for the tenant. You configure the workspace, manage roles and users, oversee governance, and can access every module.

**What you can do**
- See every module and dashboard.
- Manage tenant configuration, users, roles, modules, terminology, and custom fields.
- Review audit logs and system health.
- Configure AI settings, prompts, agents, and workflow governance.

**Key pages**
- `/admin`
- `/admin/rbac`
- `/admin/modules`
- `/admin/terminology`
- `/admin/custom-fields`
- `/admin/configuration`
- `/ai/settings`, `/ai-prompts`, `/ai-agents`
- `/logs`
- `/workflows`

**Workflow — Configure a tenant workspace**
1. Open `/admin` and review active modules.
2. Enable or disable modules as needed.
3. Update terminology and branding.
4. Create roles and assign users.
5. Review audit logs for sensitive changes.

**Tips**
- Use the configuration engine to keep settings data-driven.
- Require a reason for major config changes whenever possible.
- Keep AI provider settings safe: rate limits, redaction, and logging.

---

## 2. CRM Administrator

**Who you are:** a tenant administrator focused on day-to-day CRM administration, user configuration, and data hygiene.

**What you can do**
- Manage users and role assignments.
- Maintain option sets (statuses, stages, categories) and terminology.
- Configure custom fields and page layouts.
- Monitor audit logs and notifications.

**Key pages**
- `/admin/rbac`
- `/admin/modules`
- `/admin/terminology`
- `/admin/custom-fields`
- `/admin/configuration`
- `/logs`

**Workflow — Onboard a new user**
1. Create the user in admin user management.
2. Assign the appropriate role(s).
3. Confirm the user can sign in and only sees their granted screens.

**Tips**
- Prefer least privilege.
- Retire option values rather than deleting them.
- Validate workflows and configuration drafts before publishing.

---

## 3. Sales Development Representative (SDR)

**Who you are:** you qualify inbound and outbound leads and hand off the best ones to sales.

**What you can do**
- Use the SDR workspace (`/sales/sdr`).
- Create and update leads.
- Review lead scores, timelines, and notes.
- Use AI for summaries, qualification help, and follow-up drafts.

**Workflow — Qualify a lead**
1. Open `/sales/sdr` and pick a lead.
2. Review the lead detail page.
3. Use Ask AI to summarize or draft follow-up messaging.
4. Update status and next steps.
5. Convert or hand off qualified leads.

**Tips**
- Treat AI drafts as a starting point when they are flagged for review.
- Keep lead notes and next steps current.

---

## 4. Inside Sales Executive / Manager

**Who you are:** you progress qualified leads to opportunities and manage a book of smaller deals.

**What you can do**
- Use the inside sales workspace (`/sales/inside-sales`).
- Manage leads, accounts, contacts, and opportunities.
- Track opportunities on the pipeline board.
- Managers can view team dashboards and reassign work.

**Workflow — Turn a qualified lead into an opportunity**
1. Open a lead in `/sales/inside-sales`.
2. Create the account/contact if needed.
3. Create an opportunity and set stage/value.
4. Use the pipeline board and notes to track progress.

**Tips**
- Use saved filters and views to focus on active deals.
- Keep opportunity stage rationale documented.

---

## 5. Sales Executive / Manager / Head (Account Executive)

**Who you are:** you own opportunities through close and manage account relationships; managers/head roles oversee pipeline and performance.

**What you can do**
- Manage the full Opportunity lifecycle.
- Use Accounts, Contacts, and Opportunities screens.
- View dashboards for pipeline and forecast metrics.
- Managers govern stage moves and team performance.

**Workflow — Advance an opportunity stage**
1. Open the opportunity detail.
2. Change the stage and add a note.
3. Confirm any approval requirement.

**Tips**
- Review the pipeline dashboard for stalled deals and forecast risk.
- Use AI for account briefs and next-step recommendations.

---

## 6. Business Development

**Who you are:** you drive strategic pipeline, partnerships, and high-value opportunities beyond standard sales.

**What you can do**
- Use the Business Development module (`/business-development`).
- Manage BD initiatives, targets, and stakeholders.
- Collaborate with partners, resellers, and presales.

**Workflow — Manage a BD initiative**
1. Open `/business-development`.
2. Create or update an initiative.
3. Link related accounts, opportunities, and partners.
4. Track progress and next steps.

**Tips**
- Record value drivers and partner engagement clearly.
- Use dashboards to monitor strategic pipeline health.

---

## 7. Presales

**Who you are:** you support deals with technical qualification, demos, and proposals.

**What you can do**
- Use the Presales workspace (`/presales`).
- Track engagements, proposals, and demos.
- Use AI to draft proposal outlines and supporting content.

**Workflow — Support an opportunity**
1. Open the linked presales engagement.
2. Record technical qualification and demo notes.
3. Generate a proposal outline via AI; route it for review.

**Tips**
- Keep the handoff between sales and presales clear.
- Ensure proposal drafts are reviewed before sharing.

---

## 8. Marketing Manager / Executive

**Who you are:** you plan and run campaigns, marketing programs, and demand-generation activities.

**What you can do**
- Use the Campaigns module (`/campaigns`).
- Create campaign plans and manage members.
- Use AI for campaign content and planning.
- View campaign dashboards.

**Workflow — Launch a campaign**
1. Create a campaign with goals and schedules.
2. Add members and target segments.
3. Use AI to draft messaging or plans.
4. Track performance on the campaign dashboard.

**Tips**
- Align campaign membership with lead/contact attribution.
- Review campaign analytics regularly.

---

## 9. Social Media Marketing

**Who you are:** you create, schedule, and monitor social media content.

**What you can do**
- Use the Social module (`/social`).
- Create and schedule posts.
- Use AI for captions and hashtags.
- Track engagement and campaign alignment.

**Workflow — Create a social post**
1. Create a scheduled post in `/social/new`.
2. Use AI for copy and hashtags.
3. Review before publishing.
4. Track the post and engagement.

---

## 10. Support Executive / Manager

**Who you are:** you resolve customer tickets; managers oversee queues, escalations, and SLAs.

**What you can do**
- Use the Support module (`/support`).
- Create, triage, update, and resolve tickets.
- Use AI for suggested replies and summaries.
- Managers manage assignments and escalations.

**Workflow — Resolve a ticket**
1. Open the ticket.
2. Review customer history and context.
3. Use AI suggestions; review before sending.
4. Update status and resolve.

**Workflow — Handle an AI-escalated query**
1. Open the customer-query escalation list.
2. Review the question, answer, and sources.
3. Convert to a ticket if needed.

**Tips**
- Prioritize high-severity and SLA-breached tickets.
- Use knowledge articles to speed resolution.

---

## 11. Customer Success Manager & CS Head

**Who you are:** you drive adoption, health, onboarding, renewal, and customer outcomes.

**What you can do**
- Use the Customer Success module (`/customer-success`).
- Manage accounts, success plans, health scores, and onboarding.
- Monitor risks and escalations.
- CS Head roles oversee team performance.

**Workflow — Run onboarding**
1. Open the account and onboarding plan.
2. Track milestone completion.
3. Monitor health and risk signals.
4. Use AI for account summaries.

**Tips**
- Prioritize accounts with declining health scores.
- Work closely with support and sales for renewals.

---

## 12. Partner Manager

**Who you are:** you manage channel partners, joint opportunities, and partner performance.

**What you can do**
- Use the Partners module (`/partners`).
- Track partner tiers, agreements, and deals.
- Manage partner-sourced opportunities and engagements.

**Workflow — Manage a partner**
1. Open the partner record.
2. Update partner status, tier, and contacts.
3. Track partner-sourced pipeline.

---

## 13. Reseller Manager

**Who you are:** you manage reseller relationships and partner deal registrations.

**What you can do**
- Use the Resellers module (`/resellers`).
- Register reseller deals and track margins.
- Monitor reseller pipeline and performance.

**Workflow — Register a reseller deal**
1. Open a reseller record.
2. Create or update a deal registration.
3. Track the opportunity through the reseller pipeline.

**Tips**
- Keep reseller terms and margin details current.
- Confirm conflict management rules are followed.

---

## 14. Training / Knowledge Manager

**Who you are:** you build training programs and maintain the knowledge base that supports users and AI.

**What you can do**
- Use the Training module (`/training`).
- Manage courses, paths, and learner progress.
- Create knowledge articles and upload documents.
- Review knowledge gaps and RAG retrieval behavior.

**Workflow — Publish a knowledge article**
1. Create or update an article.
2. Send it through approval and publish.
3. Confirm the article is available for search and AI retrieval.

**Workflow — Close a knowledge gap**
1. Review the knowledge-gap dashboard.
2. Identify unanswered user queries.
3. Publish an article that resolves the gap.

---

## 15. Customer Portal User (External)

**Who you are:** an external customer using the self-service customer portal.

**What you can do**
- Access portal dashboards and tickets.
- Submit support requests.
- Ask AI questions from the portal.
- Browse permitted knowledge articles.
- Complete assigned training.

**Workflow — Use the portal AI bot**
1. Ask a question in the portal.
2. Review the grounded answer and sources.
3. If the bot cannot answer, it escalates to support.

**Tips**
- Your portal access is limited to your organization.
- Feedback improves the AI bot and knowledge base.

---

## 16. Executive Leadership

**Who you are:** you need high-level visibility into revenue, pipeline, customer success, support, and strategy.

**What you can do**
- Use executive dashboards (`/analytics`, `/dashboard`).
- Review cross-functional KPIs and trends.
- Export reports and drill into key metrics.

**Workflow — Review business health**
1. Open the executive analytics dashboard.
2. Review pipeline, forecast, health, and risk widgets.
3. Drill into areas that need attention.

**Tips**
- Use dashboard exports and saved views for leadership reviews.
- Pay attention to AI quality and customer health signals.

---

## 17. AI Administrator

**Who you are:** you govern the tenant’s AI layer, including settings, prompts, agents, and review flows.

**What you can do**
- Configure AI settings and provider defaults.
- Manage the Prompt Registry (`/ai-prompts`).
- Manage the Agent Registry (`/ai-agents`).
- Review AI Actions runs and approve sensitive outputs.
- Monitor AI usage and logging.

**Workflow — Approve a sensitive AI action**
1. Open `/ai-actions` and filter pending review.
2. Inspect the prompt, context, and output.
3. Approve or reject with a note.

**Workflow — Publish a prompt version**
1. Edit a prompt in `/ai-prompts`.
2. Submit it for activation.
3. Activate the approved version.

**Tips**
- Ensure AI settings include safe defaults before enabling live providers.
- Human review is required for sensitive output.

---

## 18. System Administrator

**Who you are:** you oversee system-level health, integrations, deployment environments, and backups.

**What you can do**
- Use the System module (`/admin/system` or `/system`).
- Monitor integrations and sync runs.
- Manage environments and deployments.
- Configure backup policies and review restore tests.
- Access the audit log viewer.

**Workflow — Monitor an integration**
1. Open `/system/integrations`.
2. Review connection health, failures, and latency.
3. Retry failed runs or mark resolved.

**Workflow — Approve a production deployment**
1. Open `/system/environments`.
2. Review the pending deployment.
3. Approve or reject per the rollout plan.

**Tips**
- Production deployments are gated by approval.
- Backups should show recent success and no RPO breaches.

---

## 19. AI Governance Manager

**Who you are:** you ensure AI usage is safe, explainable, and compliant.

**What you can do**
- Use the AI governance module (`/ai-governance`).
- Manage the AI use-case registry.
- Review AI quality dashboards and feedback.
- Monitor hallucination reports and confidence flags.
- Govern approval workflows for high-risk AI use cases.

**Workflow — Review an AI use case**
1. Open `/ai-governance/use-cases`.
2. Inspect the use case, risk level, and approval status.
3. Approve or reject changes.

**Workflow — Track AI quality**
1. Open `/ai-governance/quality`.
2. Review usage, override rate, and hallucinatio reports.
3. Create improvement tasks for low-quality areas.

**Tips**
- Treat AI quality metrics as a governance dashboard.
- Audit every change to AI prompts, agents, and policies.

---

## 20. Data Quality Manager

**Who you are:** you preserve the accuracy, completeness, and hygiene of lead and customer data.

**What you can do**
- Use the Data Quality module (`/data-quality`).
- Monitor completeness, invalid contacts, duplicates, and stale records.
- Validate imports and import error reporting.
- Review enrichment suggestions.
- Manage merge workflows with required reasons.

**Workflow — Validate an import**
1. Open `/data-quality/import/validate`.
2. Upload the import file.
3. Review row-level errors and fix them.
4. Commit the valid rows.

**Workflow — Merge duplicate records**
1. Open `/data-quality/merge`.
2. Select the master and duplicate records.
3. Choose field-level merge results and record a merge reason.

**Tips**
- Data quality is critical for accurate reporting and AI behavior.
- Preserve histories during merges and record audit reasons.

---

## 21. Additional role templates and persona variants

The platform also supports many finer-grained role templates and persona variants derived from the core personas above, including:
- Marketing Operations / RevOps
- Campaign Manager
- Digital Marketing Executive
- Inside Sales Representative
- Business Development Representative
- Account Executive / Strategic Sales
- Presales Consultant
- Solution Architect
- Proposal / Bid Manager
- Commercial / Finance Approver
- Legal / Contract Reviewer
- Reseller / Partner Sales User
- Support Agent L1 / L2
- Executive / CEO / CXO

These roles are typically built by narrowing permissions from the major persona categories described earlier and may be used to tailor access more precisely.

---

## How to use this manual

- Find your persona by title.
- Follow the key pages and workflows to locate your daily tasks.
- Use the tips to align with governance and best practices.
- Consult the linked admin and AI guides for deeper configuration and governance details.

---

## Relevant documentation

- `docs/user-guides/DEMO_LOGINS.md`
- `docs/user-guides/ADMIN_CONFIGURATION_GUIDE.md`
- `docs/user-guides/AI_ASSISTANT_USER_GUIDE.md`
- `docs/user-guides/USER_MANUAL.md`
- `docs/user-guides/ADMIN_GUIDE.md`
- `docs/ai/AI_GOVERNANCE.md`
- `docs/crm-configuration-roadmap.md`
