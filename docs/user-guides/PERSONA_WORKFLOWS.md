---
title: "AI-Native CRM — Persona-Wise Workflow Guide"
subtitle: "Step-by-step workflows for every role, each with a ready-to-use demo login"
---

**Audience:** every user and evaluator, organised by persona/role.
**Scope:** the day-to-day, end-to-end workflows each persona runs — with a demo login so you can sign in and follow along on the live demo.
**Companion document:** *Module Guide* (what each module does and how it connects).

---

## How to sign in to the demo

Every canonical role has a ready-made login on the seeded demo tenant, so you can experience RBAC first-hand — the **left navigation adapts to each role**, and actions a role lacks are hidden or denied (`403 / Unauthorized`).

| Field | Value |
|-------|-------|
| **Tenant** | `apar-elite` |
| **Password (all 28 persona logins)** | `AparDemo@2026!` |
| **Administrator login** | `demo.admin@apar-elite.com` / `AparAdmin@2026!` |
| **Email pattern** | the role name in lower-case, dot-separated, `@apar-elite.com` |

> The data is pre-seeded: 200+ education-organisation leads plus sample accounts and opportunities, so dashboards and lists are populated from the first sign-in. These are demo accounts with a shared, well-known password — never seed them in a production tenant.

**What to look for (RBAC in action):** Super Admin sees everything; a Support Executive sees support; the Customer Portal User only sees the external portal (`/portal/*`). If a module is missing from your navigation, your role doesn't grant it (or the tenant disabled it).

---

## Persona index

| # | Persona | Demo login (`@apar-elite.com`) | Primary modules |
|---|---------|-------------------------------|-----------------|
| 1 | Platform / Super Admin | `super.admin` | Administration, everything |
| 2 | CRM Admin | `crm.admin` | Administration, users, config |
| 3 | Sales Development Rep (SDR) | `sales.development.representative` | SDR workspace, Leads |
| 4 | SDR Manager | `sdr.manager` | SDR workspace, dashboards |
| 5 | Inside Sales Executive | `inside.sales.executive` | Inside-sales workspace |
| 6 | Inside Sales Manager | `inside.sales.manager` | Inside-sales, team dashboards |
| 7 | Sales Executive | `sales.executive` | Opportunities, Accounts |
| 8 | Sales Manager | `sales.manager` | Pipeline, team rollups |
| 9 | Sales Head / Leader | `sales.head` / `sales.leader` | Pipeline governance, analytics |
| 10 | Business Development | `business.development.manager` / `…executive` | Business Development |
| 11 | Presales | `presales.manager` / `presales.executive` | Presales |
| 12 | Marketing Manager / Executive | `marketing.manager` / `marketing.executive` | Campaigns |
| 13 | Social Media Marketing | `social.media.marketing.manager` / `…executive` | Social |
| 14 | Support Executive / Manager | `support.executive` / `support.manager` | Support / Tickets |
| 15 | Customer Success (Onboarding/Scaled/Enterprise) | `customer.success.manager.onboarding` … | Customer Success |
| 16 | CS Head | `customer.success.head` | CS portfolio, dashboards |
| 17 | Partner Manager | `partner.manager` | Partners |
| 18 | Reseller Manager | `reseller.manager` | Resellers, deal registration |
| 19 | Executive Leadership | `executive.leadership` | Analytics & dashboards |
| 20 | Customer Portal User (external) | `customer.portal.user` | Customer Portal |

> Training / Knowledge and AI Administration are typically held by an admin or a dedicated role; on the demo, sign in as **Super Admin** to exercise those workflows.

---

## 1. Platform / Super Admin

**Login:** `super.admin@apar-elite.com` · **Who you are:** the highest-privilege administrator — you configure the tenant, manage roles and users, and oversee AI governance.

**Workflow — Create a role and assign permissions**
1. Go to `/admin/rbac`.
2. Select **Create role**; give it a name and description.
3. Choose module permissions (view / create / edit / delete / configure, etc.).
4. Save — the role becomes assignable to users.

**Workflow — Enable or disable a module**
1. Go to `/admin/modules`.
2. Toggle a module on/off (disabled modules disappear from users' navigation).
3. Save — the change is audit-logged.

**Workflow — Brand the workspace**
1. `/admin/theme` — set colours/logo.
2. `/admin/terminology` — rename objects (e.g. "Opportunities" → "Deals").
3. Save — labels update across the app for everyone in the tenant.

**Tips.** Every configuration change is audited. Production enforces strong secrets and secure cookies automatically.

---

## 2. CRM Admin

**Login:** `crm.admin@apar-elite.com` · **Who you are:** a tenant administrator focused on day-to-day CRM administration (users, configuration, data hygiene).

**Workflow — Onboard a new internal user**
1. Create the user in admin user management.
2. Assign the appropriate role(s) for their persona.
3. Confirm they can sign in and see only the screens their role grants.

**Tips.** Prefer least privilege — assign the narrowest role that lets someone do their job. Use terminology settings instead of customising code.

---

## 3. Sales Development Representative (SDR)

**Login:** `sales.development.representative@apar-elite.com` · **Manager:** `sdr.manager@apar-elite.com` · **Who you are:** you prospect and qualify inbound/outbound leads and hand off qualified ones.

**Workflow — Qualify a lead**
1. Open `/sales/sdr` and pick a lead from your queue.
2. Review the lead detail (`/leads/:leadId`): timeline, notes, score.
3. Use **Ask AI** for a lead summary or a follow-up email draft (sensitive drafts return for review).
4. Update status/qualification and log the next step.
5. Convert/hand off qualified leads to inside sales or an account executive.

**Tips.** AI drafts flagged "review" aren't final until an authorised reviewer approves them. Keep notes and next steps current — they feed dashboards and handoffs.

---

## 4. Inside Sales Executive / Manager

**Login:** `inside.sales.executive@apar-elite.com` · **Manager:** `inside.sales.manager@apar-elite.com` · **Who you are:** you progress qualified leads into opportunities and manage a book of smaller deals.

**Workflow — Turn a qualified lead into an opportunity**
1. From `/sales/inside-sales`, open the lead.
2. Create the associated **Account**/**Contact** if needed.
3. Create an **Opportunity** (`/opportunities/new`); set stage and value.
4. Track progression on the pipeline board.

**Tips.** Use list filters and saved views to focus on your active book. Managers can view team dashboards and reassign work.

---

## 5. Sales Executive / Manager / Head (Account Executive)

**Logins:** `sales.executive` · `sales.manager` · `sales.head` · `sales.leader` (`@apar-elite.com`) · **Who you are:** you own opportunities through close and manage account relationships; managers/heads oversee pipeline and team performance.

**Workflow — Advance an opportunity stage**
1. Open `/opportunities` (list or Kanban) and select the opportunity.
2. On the detail screen, change the **stage**; add a note describing the next step.
3. Stage changes are audited; some transitions may require permission.

**Workflow — Maintain an account relationship**
1. Open `/accounts/:accountId`.
2. Review the timeline (meetings, emails, notes), related contacts, and opportunities.
3. Use **Ask AI** for an account brief or relationship summary.

**Tips.** Use the pipeline dashboard to spot stalled deals and at-risk forecasts.

---

## 6. Business Development

**Logins:** `business.development.manager` · `business.development.executive` (`@apar-elite.com`) · **Who you are:** you drive strategic pipeline and partnerships beyond standard inbound sales.

**Workflow — Manage a BD initiative**
1. Open `/business-development`.
2. Create/track the initiative and its pipeline entries.
3. Link related accounts/opportunities; record progress and next steps.

---

## 7. Presales

**Logins:** `presales.manager` · `presales.executive` (`@apar-elite.com`) · **Who you are:** you support deals with technical qualification, demos, and proposals.

**Workflow — Support an opportunity**
1. Open `/presales` and the linked engagement.
2. Record technical qualification, demo notes, and proposal status.
3. Generate a proposal outline via **AI Actions**; route it for review before sending.

---

## 8. Marketing Manager / Executive

**Logins:** `marketing.manager` · `marketing.executive` (`@apar-elite.com`) · **Who you are:** you plan and run campaigns and manage marketing-sourced pipeline.

**Workflow — Launch a campaign**
1. Go to `/campaigns/new`; set name, type, dates, and goals.
2. Add **members** (target leads/contacts) to the campaign.
3. Use **AI Actions** for a campaign plan or email copy; send drafts to review.
4. Track performance on the campaign dashboard.

**Tips.** Campaign membership ties into lead/contact records for attribution.

---

## 9. Social Media Marketing

**Logins:** `social.media.marketing.manager` · `social.media.marketing.executive` (`@apar-elite.com`) · **Who you are:** you create and schedule social content and track engagement.

**Workflow — Create a social post**
1. Go to `/social/new`; compose the post and set the channel/schedule.
2. Use **Ask AI** for a caption or hashtags; review before publishing.
3. Save/schedule; track on the social detail screen.

---

## 10. Support Executive / Manager

**Logins:** `support.executive` · `support.manager` (`@apar-elite.com`) · **Who you are:** you resolve customer tickets; managers oversee the queue and SLAs.

**Workflow — Resolve a ticket**
1. Open `/support` (or `/tickets`) and select a ticket.
2. Review history and customer context.
3. Use **AI suggested response**; edit and (if flagged) route for review.
4. Update status/priority; resolve when complete.

**Workflow — Handle an AI-escalated query**
1. Open `/customer-query` to see sessions the AI bot escalated (low confidence, no answer, or sensitive topics).
2. Review the question, the AI's grounded answer, and citations.
3. Take over: respond, or convert to a ticket; mark resolved.

**Tips.** Knowledge gaps surfaced by the bot (`/customer-query/gaps`) tell you which articles to add.

---

## 11. Customer Success Manager & CS Head

**Logins:** `customer.success.manager.onboarding` · `…scaled` · `…enterprise` · `customer.success.head` (`@apar-elite.com`) · **Who you are:** you drive adoption, health, onboarding, and renewals.

**Workflow — Run an onboarding**
1. Open `/customer-success` and the assigned account.
2. Follow the onboarding playbook tasks; record completion.
3. Monitor the **health score**; act on risk indicators.
4. Use AI for a health-indicator explanation or account brief.

**Tips.** Health scoring combines signals — use it to prioritise outreach. CS Head sees portfolio rollups and team oversight.

---

## 12. Partner Manager

**Login:** `partner.manager@apar-elite.com` · **Who you are:** you manage partner relationships and partner-sourced pipeline.

**Workflow — Manage a partner**
1. Open `/partners` and the partner record.
2. Maintain tier, contacts, and engagement notes.
3. Track partner-sourced opportunities.

---

## 13. Reseller Manager

**Login:** `reseller.manager@apar-elite.com` · **Who you are:** you manage resellers, deal registrations, and channel pipeline.

**Workflow — Register and track a deal**
1. Open `/resellers` and the reseller.
2. Register a deal (links the reseller to an opportunity with margin/agreement details).
3. Track status through the scoped pipeline.

**Tips.** Your pipeline view is scoped to the resellers/owners you're permitted to see.

---

## 14. Training / Knowledge Manager

**Login (demo):** `super.admin@apar-elite.com` · **Who you are:** you build training and curate the knowledge base that grounds AI answers.

**Workflow — Publish a knowledge article**
1. Go to `/knowledge/articles`; create/edit an article.
2. Move it through **approved** and **published** states.
3. Only approved + published, permission-appropriate articles are used by AI retrieval and the customer-query bot.

**Workflow — Close a knowledge gap**
1. Open the knowledge-gap dashboard (`/customer-query/gaps`).
2. Pick a recurring unanswered query; author an article that answers it.
3. Publish; mark the gap resolved.

**Tips.** Use the **RAG console** (`/knowledge/rag-console`) to preview what the AI would retrieve and verify permission filtering.

---

## 15. Customer Portal User (External)

**Login:** `customer.portal.user@apar-elite.com` · **Who you are:** an external customer using the self-service portal — you only see your own organisation's data.

**Workflow — Get help via the AI bot**
1. Open **Ask AI** in the portal (`/portal/*`).
2. Type your question. The bot answers **only** from approved knowledge and shows its sources.
3. If it can't find a confident, approved answer, it tells you and **escalates** (often creating a support ticket) instead of guessing.
4. Rate the answer **helpful / not helpful** — your feedback improves the knowledge base.

**Tips.** You'll never see another customer's data. Urgent/sensitive topics (e.g. outages, billing) are escalated automatically.

---

## 16. Executive Leadership

**Login:** `executive.leadership@apar-elite.com` · **Who you are:** you need cross-functional visibility, not day-to-day data entry.

**Workflow — Review the business**
1. Open `/analytics` and the **Executive** dashboard.
2. Apply date filters; drill into widgets.
3. Export where needed (exports are audit-logged).

**Tips.** Set your most-used dashboard as your personal default so it opens on sign-in.

---

## 17. AI Administrator

**Login (demo):** `super.admin@apar-elite.com` · **Who you are:** you govern the AI layer — prompts, agents, actions, settings, and retrieval.

**Workflow — Approve a sensitive AI action**
1. Open `/ai-actions`; filter to **pending review**.
2. Open a run; inspect the resolved prompt and output.
3. **Approve** or **Reject** with a note. Only approved outputs are usable; all decisions are audit-logged.

**Workflow — Publish a new prompt version**
1. Open `/ai-prompts`; edit a template (creates a new version).
2. Submit for approval/activation per your permissions.
3. Activate the version; callers reference it by `templateKey` (prompts are never hardcoded).

**Tips.** Before enabling live AI providers, ensure rate-limit enforcement and output redaction are in place. All AI calls run through one governed gateway; agents declare their data-access scope and whether they need human approval.

---

## Troubleshooting (any persona)

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| "You do not have permission" / Unauthorized | Your role lacks that action | Ask an admin to grant the role/permission |
| Can't sign in ("Invalid tenant, email, or password") | Wrong tenant/email/password, or account locked | Verify all three; wait out a lockout or contact an admin |
| A module is missing from navigation | Module disabled for the tenant, or role lacks access | Confirm with an admin |
| AI answer says it couldn't find an approved answer | No approved/published knowledge matched | The query is escalated; a knowledge gap is logged for authors |
| AI output marked "pending review" | It's a sensitive action | An authorised reviewer must approve before it's usable |
| Labels differ from this guide | Tenant terminology customisation | Behaviour is the same; your admin renamed objects |

---

*Companion: see the **Module Guide** for what each module does and how it connects. Source of record: `docs/user-guides/USER_MANUAL.md` and the [Documentation Index](../DOCUMENTATION_INDEX.md).*
