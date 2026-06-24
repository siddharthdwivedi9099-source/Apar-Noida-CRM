# AI-Native CRM — Full User Manual (Persona-Wise)

**Audience:** every user of the platform, organized by persona/role.
**Scope:** end-to-end usage of the web application — navigation, every persona's day-to-day workflows, the AI assistant, the customer portal, administration, and configuration.
**How to use this manual:** find your persona in the Table of Contents and read that section; the Common Concepts and Cross-Cutting Features sections apply to everyone. Screen paths in `monospace` are the in-app routes (the part of the URL after the host).

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Common Concepts](#2-common-concepts)
3. [Navigation & Screens](#3-navigation--screens)
4. Personas
   - 4.1 [Platform / Super Admin](#41-platform--super-admin)
   - 4.2 [CRM Admin](#42-crm-admin)
   - 4.3 [Sales Development Representative (SDR)](#43-sales-development-representative-sdr)
   - 4.4 [Inside Sales Executive / Manager](#44-inside-sales-executive--manager)
   - 4.5 [Sales Executive / Manager / Head (Account Executive)](#45-sales-executive--manager--head-account-executive)
   - 4.6 [Business Development](#46-business-development)
   - 4.7 [Presales](#47-presales)
   - 4.8 [Marketing Manager / Executive](#48-marketing-manager--executive)
   - 4.9 [Social Media Marketing](#49-social-media-marketing)
   - 4.10 [Support Executive / Manager](#410-support-executive--manager)
   - 4.11 [Customer Success Manager (Onboarding / Scaled / Enterprise) & CS Head](#411-customer-success-manager--cs-head)
   - 4.12 [Partner Manager](#412-partner-manager)
   - 4.13 [Reseller Manager](#413-reseller-manager)
   - 4.14 [Training / Knowledge Manager](#414-training--knowledge-manager)
   - 4.15 [Customer Portal User (External)](#415-customer-portal-user-external)
   - 4.16 [Executive Leadership](#416-executive-leadership)
   - 4.17 [AI Administrator](#417-ai-administrator)
5. [Cross-Cutting Features](#5-cross-cutting-features)
6. [Troubleshooting & FAQ](#6-troubleshooting--faq)
7. [Glossary](#7-glossary)

---

## 1. Getting Started

### 1.1 What the platform is
An AI-native, multi-tenant CRM that unifies sales, marketing, partner/reseller channels, support, customer success, training, and a customer self-service portal — with a governed AI layer (assistant, actions, retrieval-grounded answers) woven throughout.

### 1.2 Accessing the application
- Open the web app URL provided by your administrator (in local development: `http://localhost:5173`).
- You will land on the **Login** screen (`/login`).

### 1.3 Signing in
1. Enter your **Tenant** (organization slug), **Email**, and **Password**.
2. Select **Sign in**.
3. On success you are taken to your **Dashboard** (`/dashboard`).

**Notes**
- After several failed attempts your account is temporarily **locked** (a security control); wait for the lockout window or contact an admin.
- Sessions stay signed in via a secure refresh token; you are signed out on **Logout** or when the session expires.
- If you see "Invalid tenant, email, or password," any of the three may be wrong — the message is deliberately generic for security.

### 1.4 Signing out
Use the account menu → **Logout**. This revokes your session immediately.

---

## 2. Common Concepts

| Concept | What it means for you |
|---------|------------------------|
| **Tenant** | Your organization. You only ever see your tenant's data; cross-tenant access is impossible by design. |
| **Roles & permissions** | What you can see and do is governed by your assigned role(s). If a button or menu is missing, your role doesn't grant it. A `403`/"You do not have permission" message means an action is outside your role. |
| **Configurability** | Admins can rename objects (terminology), toggle modules on/off, theme the UI, and add custom fields — so labels and available screens vary per tenant. |
| **Audit trail** | Sensitive actions (logins, permission denials, exports, AI runs, configuration changes) are logged for compliance. |
| **AI assistant** | A governed assistant is available across the app; sensitive AI outputs require human review before they're considered usable. |
| **Soft delete** | Most "Delete" actions archive a record (it can be restored by an admin) rather than destroying data. |

---

## 3. Navigation & Screens

The left navigation adapts to your permissions. Common destinations:

| Area | Path | Who typically uses it |
|------|------|------------------------|
| Dashboard | `/dashboard` | Everyone |
| Leads | `/leads` | Sales, SDR, marketing |
| Accounts | `/accounts` | Sales, CS, support |
| Contacts | `/contacts` | Sales, CS, support, marketing |
| Opportunities | `/opportunities` | Sales |
| Campaigns | `/campaigns` | Marketing |
| Social | `/social` | Social media marketing |
| SDR workspace | `/sales/sdr` | SDR |
| Inside-sales workspace | `/sales/inside-sales` | Inside sales |
| Business development | `/business-development` | BD |
| Presales | `/presales` | Presales |
| Partners | `/partners` | Partner managers |
| Resellers | `/resellers` | Reseller managers |
| Support | `/support`, `/tickets` | Support |
| Customer success | `/customer-success` | CS |
| Training | `/training` | Training, learners |
| Knowledge base | `/knowledge`, `/knowledge/articles` | Knowledge managers |
| Analytics & dashboards | `/analytics` | Managers, executives |
| Notifications | `/notifications` | Everyone |
| Approvals | `/approvals` | Approvers |
| Workflows | `/workflows` | Admins, ops |
| AI assistant | `/ai-assistant`, `/ask-ai` | Everyone (permitting) |
| AI actions / agents / prompts | `/ai-actions`, `/ai-agents`, `/ai-prompts` | AI admins |
| Customer-query review | `/customer-query`, `/customer-query/gaps` | Support/AI reviewers |
| RAG console | `/knowledge/rag-console` | AI/knowledge admins |
| Administration | `/admin` (rbac, modules, theme, terminology, custom-fields) | Admins |
| Profile | `/profile` | Everyone |
| Customer portal | `/portal/*` | External customers |

If you navigate to a screen your role can't access you'll see the **Unauthorized** page.

---

## 4. Personas

Each persona below lists: **who you are**, **what you can do**, **key step-by-step workflows**, and **tips**.

### 4.1 Platform / Super Admin

**Who you are:** the highest-privilege administrator. You configure the tenant, manage roles and users, oversee AI governance, and can access every module.

**What you can do**
- Manage roles and permissions (`/admin/rbac`).
- Enable/disable modules per tenant (`/admin/modules`).
- Theme the UI (`/admin/theme`) and rename objects/terminology (`/admin/terminology`).
- Define custom fields (`/admin/custom-fields`).
- Review the audit log and data-governance settings.
- Configure AI settings, prompts, and agents.

**Workflow — Create a role and assign permissions**
1. Go to `/admin/rbac`.
2. Select **Create role**; give it a name and description.
3. Choose the module permissions (view/create/edit/delete/configure, etc.).
4. Save. The role becomes assignable to users.

**Workflow — Enable or disable a module**
1. Go to `/admin/modules`.
2. Toggle a module on/off. Disabled modules disappear from users' navigation.
3. Save; changes are audit-logged.

**Workflow — Brand the workspace**
1. `/admin/theme` — set colors/logo; `/admin/terminology` — rename objects (e.g., "Opportunities" → "Deals").
2. Save; labels update across the app for all users in the tenant.

**Tips**
- Every configuration change is recorded in the audit log.
- Production deployments enforce strong secrets and secure cookies automatically; coordinate environment settings with your DevOps team.

### 4.2 CRM Admin

**Who you are:** a tenant administrator focused on day-to-day CRM administration (users, configuration, data hygiene) without necessarily holding platform-level powers.

**What you can do**
- Manage users and role assignments.
- Maintain option sets (statuses, stages, categories) and terminology.
- Configure custom fields and module settings.
- Monitor audit and notifications.

**Workflow — Onboard a new internal user**
1. Create the user (admin user management).
2. Assign the appropriate role(s) for their persona.
3. Confirm they can sign in and see only the screens their role grants.

**Tips**
- Prefer least-privilege: assign the narrowest role that lets someone do their job.
- Use terminology settings to match your company's vocabulary instead of customizing code.

### 4.3 Sales Development Representative (SDR)

**Who you are:** you prospect and qualify inbound/outbound leads and hand off qualified ones.

**What you can do**
- Work the **SDR workspace** (`/sales/sdr`): prioritized leads, qualification, next steps.
- Create and update **Leads** (`/leads`, `/leads/new`).
- Use the **AI assistant** for lead summaries, intent detection, and follow-up drafts.

**Workflow — Qualify a lead**
1. Open `/sales/sdr` and pick a lead from your queue.
2. Review the lead detail (`/leads/:leadId`): activity timeline, notes, score.
3. Use **Ask AI** for a lead summary or a follow-up email draft (sensitive drafts are returned for review).
4. Update status/qualification and log the next step.
5. Convert/hand off qualified leads to inside sales or an account executive.

**Tips**
- AI follow-up drafts flagged "review" are not final until an authorized reviewer approves them.
- Keep notes and next steps current — they feed dashboards and handoffs.

### 4.4 Inside Sales Executive / Manager

**Who you are:** you progress qualified leads toward opportunities and manage a book of smaller deals.

**What you can do**
- Use the **inside-sales workspace** (`/sales/inside-sales`).
- Manage **Leads**, **Accounts**, **Contacts**, and **Opportunities**.
- Managers: view team dashboards and reassign work.

**Workflow — Turn a qualified lead into an opportunity**
1. From `/sales/inside-sales`, open the lead.
2. Create the associated **Account**/**Contact** if needed.
3. Create an **Opportunity** (`/opportunities/new`), set stage and value.
4. Track progression on the pipeline board.

**Tips**
- Use list filters and saved views to focus on your active book.

### 4.5 Sales Executive / Manager / Head (Account Executive)

**Who you are:** you own opportunities through close and manage account relationships; managers/heads oversee pipeline and team performance.

**What you can do**
- Full **Opportunity** lifecycle (`/opportunities`): create, edit, move stages (role-aware), Kanban pipeline.
- Manage **Accounts** (`/accounts`) and **Contacts** (`/contacts`) with timelines and notes.
- View **Dashboards/Analytics** (`/analytics`) for pipeline metrics.
- Managers: stage-movement governance, team rollups.

**Workflow — Advance an opportunity stage**
1. Open `/opportunities` (list or Kanban) and select the opportunity.
2. On the detail screen, change the **stage**; add a note describing the next step.
3. Stage changes are audited; some transitions may require permission.

**Workflow — Maintain an account relationship**
1. Open `/accounts/:accountId`.
2. Review the timeline (meetings, emails, notes), related contacts, and opportunities.
3. Use **Ask AI** for an account brief or relationship summary.

**Tips**
- Use the pipeline dashboard to spot stalled deals and at-risk forecasts.

### 4.6 Business Development

**Who you are:** you drive strategic pipeline and partnerships beyond standard inbound sales.

**What you can do**
- Use the **Business Development** module (`/business-development`) to manage BD pipeline and initiatives.
- Collaborate with partners/resellers and presales.

**Workflow — Manage a BD initiative**
1. Open `/business-development`.
2. Create/track the initiative and its pipeline entries.
3. Link related accounts/opportunities; record progress and next steps.

### 4.7 Presales

**Who you are:** you support deals with technical qualification, demos, and proposals.

**What you can do**
- Use the **Presales** module (`/presales`) to track presales engagements and deliverables.
- Use AI to draft proposal outlines (sensitive → review).

**Workflow — Support an opportunity**
1. Open `/presales` and the linked engagement.
2. Record technical qualification, demo notes, and proposal status.
3. Generate a proposal outline via AI Actions; route it for review before sending.

### 4.8 Marketing Manager / Executive

**Who you are:** you plan and run campaigns and manage marketing-sourced pipeline.

**What you can do**
- Full **Campaigns** lifecycle (`/campaigns`): create, edit, manage members.
- Use AI for campaign plans, email copy, and audience suggestions (sensitive → review).
- View campaign dashboards.

**Workflow — Launch a campaign**
1. Go to `/campaigns/new`; set name, type, dates, and goals.
2. Add **members** (target leads/contacts) to the campaign.
3. Use **AI Actions** for a campaign plan or email copy; send drafts to review.
4. Track performance on the campaign dashboard.

**Tips**
- Campaign membership ties into lead/contact records for attribution.

### 4.9 Social Media Marketing

**Who you are:** you create and schedule social content and track engagement.

**What you can do**
- Manage **Social** posts (`/social`, `/social/new`): create, edit, schedule.
- Use AI for captions and hashtag suggestions (sensitive → review).

**Workflow — Create a social post**
1. Go to `/social/new`; compose the post and set the channel/schedule.
2. Use **Ask AI** for a caption or hashtags; review before publishing.
3. Save/schedule; track on the social detail screen.

### 4.10 Support Executive / Manager

**Who you are:** you resolve customer tickets; managers oversee the queue and SLAs.

**What you can do**
- Manage **Tickets** (`/support`, `/tickets`): create, triage, update, resolve.
- Use AI for suggested replies and ticket summaries (sensitive → review).
- Managers: assignment, escalation oversight, support dashboards.
- Review AI customer-query sessions that escalated into tickets (`/customer-query`).

**Workflow — Resolve a ticket**
1. Open `/support` (or `/tickets`) and select a ticket.
2. Review history and customer context.
3. Use **AI suggested response**; edit and (if flagged) route for review.
4. Update status/priority; resolve when complete.

**Workflow — Handle an AI-escalated query**
1. Open `/customer-query` to see sessions the AI bot escalated (low confidence, no answer, or level-3 topics).
2. Review the question, the AI's grounded answer, and citations.
3. Take over: respond, or convert to a ticket; mark resolved.

**Tips**
- Knowledge gaps surfaced by the AI bot (`/customer-query/gaps`) tell you which articles to add.

### 4.11 Customer Success Manager & CS Head

**Who you are:** you drive adoption, health, onboarding, and renewals. Variants: **Onboarding**, **Scaled**, **Enterprise**, and **CS Head** (oversight).

**What you can do**
- Use the **Customer Success** module (`/customer-success`): managed accounts, health scores, onboarding plans, playbooks.
- View health dashboards and at-risk accounts.
- CS Head: portfolio rollups and team oversight.

**Workflow — Run an onboarding**
1. Open `/customer-success` and the assigned account.
2. Follow the onboarding playbook tasks; record completion.
3. Monitor the **health score**; act on risk indicators.
4. Use AI for a health-indicator explanation or account brief.

**Tips**
- Health scoring combines signals; use it to prioritize outreach.

### 4.12 Partner Manager

**Who you are:** you manage partner relationships and partner-sourced pipeline.

**What you can do**
- Use the **Partners** module (`/partners`): partner records, tiers, engagements.
- Collaborate with BD and resellers.

**Workflow — Manage a partner**
1. Open `/partners` and the partner record.
2. Maintain tier, contacts, and engagement notes.
3. Track partner-sourced opportunities.

### 4.13 Reseller Manager

**Who you are:** you manage resellers, deal registrations, and channel pipeline.

**What you can do**
- Use the **Resellers** module (`/resellers`): reseller records, **deal registration**, scoped pipeline, margins.
- Use AI for reseller-growth insights.

**Workflow — Register and track a deal**
1. Open `/resellers` and the reseller.
2. Register a deal (links the reseller to an opportunity with margin/agreement details).
3. Track status through the scoped pipeline.

**Tips**
- Your pipeline view is scoped to the resellers/owners you're permitted to see.

### 4.14 Training / Knowledge Manager

**Who you are:** you build training and curate the knowledge base that grounds AI answers.

**What you can do**
- Manage **Training** (`/training`): learning paths, courses, learner progress.
- Manage the **Knowledge base** (`/knowledge`, `/knowledge/articles`): author, review, approve, and publish articles.
- Upload documents (`/knowledge/upload`) and inspect retrieval via the **RAG console** (`/knowledge/rag-console`).
- Review **knowledge gaps** (`/knowledge-gap-dashboard` / `/customer-query/gaps`).

**Workflow — Publish a knowledge article**
1. Go to `/knowledge/articles`; create/edit an article.
2. Move it through **approved** and **published** states.
3. Only approved + published, permission-appropriate articles are used by AI retrieval and the customer-query bot.

**Workflow — Close a knowledge gap**
1. Open the knowledge-gap dashboard.
2. Pick a recurring unanswered query; author an article that answers it.
3. Publish; mark the gap resolved.

**Tips**
- Use the RAG console to preview what the AI would retrieve for a query and verify permission filtering.

### 4.15 Customer Portal User (External)

**Who you are:** an external customer using the self-service portal. You only see your own organization's data.

**What you can do (`/portal/*`)**
- **Dashboard** (`/portal/dashboard`): your overview.
- **Tickets** (`portal tickets`): raise and track support tickets.
- **Ask AI** (`customer-portal-ask-ai`): ask questions; get answers grounded in approved knowledge with citations, or an automatic escalation.
- **Knowledge** (`customer-portal-knowledge`): browse permitted articles.
- **Training** (`customer-portal-training`): access assigned training.
- **Profile** (`customer-portal-profile`): manage your details.

**Workflow — Get help via the AI bot**
1. Open **Ask AI** in the portal.
2. Type your question. The bot answers **only** from approved knowledge and shows its sources.
3. If it can't find a confident, approved answer, it tells you and **escalates** (often creating a support ticket) instead of guessing.
4. Rate the answer **helpful / not helpful** — your feedback improves the knowledge base.

**Tips**
- You will never see another customer's data; access is restricted to your account.
- Urgent/sensitive topics (e.g., outages, billing) are escalated automatically.

### 4.16 Executive Leadership

**Who you are:** you need cross-functional visibility, not day-to-day data entry.

**What you can do**
- View **Analytics & dashboards** (`/analytics`, `/dashboard`): executive overview, pipeline, campaigns, support, CS health.
- Drill down and export dashboards (subject to permission).
- Use AI for executive insight summaries.

**Workflow — Review the business**
1. Open `/analytics` and the **Executive** dashboard.
2. Apply date filters; drill into widgets.
3. Export where needed (exports are audit-logged).

### 4.17 AI Administrator

**Who you are:** you govern the AI layer — prompts, agents, actions, settings, and retrieval.

**What you can do**
- Configure tenant **AI settings** (provider/model, rate limit, redaction, logging).
- Manage the **Prompt Registry** (`/ai-prompts`): versioned, approvable prompt templates.
- Manage the **Agent Registry** (`/ai-agents`): agents with tools, data scope, and human-approval rules.
- Review **AI Actions** runs (`/ai-actions`) and approve/reject sensitive outputs.
- Tune retrieval via the **RAG console** and monitor **AI usage logs**.

**Workflow — Approve a sensitive AI action**
1. Open `/ai-actions`; filter to **pending review**.
2. Open a run; inspect the resolved prompt and output.
3. **Approve** or **Reject** with a note. Only approved outputs are usable; all decisions are audit-logged.

**Workflow — Publish a new prompt version**
1. Open `/ai-prompts`; edit a template (creates a new version).
2. Submit for approval/activation per your permissions.
3. Activate the version; callers reference it by `templateKey` (prompts are never hardcoded).

**Tips**
- Before enabling live AI providers, ensure rate-limit enforcement and output redaction are in place (see AI governance docs).
- AI calls run through one governed gateway; agents declare their data-access scope and whether they need human approval.

---

## 5. Cross-Cutting Features

### 5.1 AI Assistant (`/ai-assistant`, `/ask-ai`, `/ai-help`)
- Available across the app where your permissions allow (`ai.use_ai`).
- Answers and drafts are governed: prompts come from the managed registry, every run is logged, and **sensitive outputs require human review** before use.
- Retrieval-grounded answers cite their sources; the assistant won't fabricate when it lacks grounding.

### 5.2 Dashboards & Insights (`/analytics`, `/dashboard`)
- Role-aware: you only see dashboards your permissions grant.
- Features: date filters, widget **drilldown**, **export**, and **saved views** (you can edit/delete your own).

### 5.3 Notifications (`/notifications`)
- In-app notifications with **preferences** (what you're notified about) and **mark read / mark all read**.

### 5.4 Approvals (`/approvals`)
- Generic approval requests (used by workflows and sensitive actions): review, **approve/reject**, and comment. Approvals are permissioned and audited.

### 5.5 Workflows (`/workflows`)
- Automations with conditions and actions. Admin/ops users create and manage them; runs integrate with approvals and notifications.

### 5.6 Search, Profile, and Settings
- **Profile** (`/profile`): your details and preferences.
- Navigation, labels, and available modules reflect your tenant's configuration and your role.

### 5.7 Audit & Compliance
- Logins, permission denials, exports, configuration changes, and AI runs are recorded. Admins can review the audit trail.

---

## 6. Troubleshooting & FAQ

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| "You do not have permission" / Unauthorized page | Your role lacks that action | Ask an admin to grant the role/permission |
| Can't sign in ("Invalid tenant, email, or password") | Wrong tenant/email/password, or account locked | Verify all three; wait out a lockout or contact an admin |
| A module is missing from navigation | Module disabled for the tenant, or role lacks access | Confirm with an admin |
| AI answer says it couldn't find an approved answer | No approved/published knowledge matched | The query is escalated; a knowledge gap is logged for authors |
| AI output marked "pending review" | It's a sensitive action | An authorized reviewer must approve before it's usable |
| Labels differ from this manual | Tenant terminology customization | Your admin renamed objects; behavior is the same |
| Data endpoints return "unavailable" | Database integration disabled (non-prod) | Expected in offline mode; use a configured environment |

---

## 7. Glossary

- **Tenant** — an isolated organization/workspace.
- **Role / Permission** — the access bundle that governs what you can see and do.
- **Opportunity** — a sales deal (may be renamed by your tenant).
- **Pipeline** — the stages a deal moves through.
- **Campaign** — a marketing program with members and metrics.
- **Deal registration** — a reseller claiming/registering a deal.
- **Health score** — a customer-success risk/adoption indicator.
- **Knowledge article** — a curated answer; must be approved + published to ground AI.
- **RAG** — retrieval-augmented generation: grounding AI answers in approved knowledge with citations.
- **AI action** — a predefined AI task (summary, draft, recommendation) run through the governed gateway.
- **Agent** — a configured AI assistant with declared tools, data scope, and approval rules.
- **Escalation** — routing an AI query or ticket to a human/queue.
- **Audit log** — the immutable record of sensitive events.

---

*See also the persona-specific guides in `docs/user-guides/` and the [Documentation Index](../DOCUMENTATION_INDEX.md). For administration depth, see [ADMIN_GUIDE.md](./ADMIN_GUIDE.md); for AI specifics, [AI_ASSISTANT_USER_GUIDE.md](./AI_ASSISTANT_USER_GUIDE.md) and [../ai/AI_GOVERNANCE.md](../ai/AI_GOVERNANCE.md).*
