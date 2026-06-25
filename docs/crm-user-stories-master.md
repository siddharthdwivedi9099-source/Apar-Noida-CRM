> **Status:** Reference only — the **master CRM requirement document** ("the Bible") governing future phases.
> Nothing here is implemented automatically; phases are planned **against** it, using the configuration engine wherever possible (see `CLAUDE.md`).
> Related: [configuration-engine.md](./configuration-engine.md), [configuration-engine-audit.md](./configuration-engine-audit.md), [crm-configuration-roadmap.md](./crm-configuration-roadmap.md).
>
> **⚠️ Ingestion note:** the source was pasted in parts and the first paste was truncated by a message-size limit at **Persona 16 (Proposal / Bid Manager)**. Content below Personas 1–15 is complete; Persona 16 onward is **pending paste** (see the marker at the end of this file).

---

# AI-Driven CRM — Master User Stories and SOP Bible

## Purpose of This Document

This document is the master requirement reference for the AI-driven CRM. It must be treated as the CRM requirement bible.

This document defines:

* CRM personas
* Standard operating procedures for each persona
* Lead-to-opportunity-to-closure journey
* Marketing, sales, presales, partner, support, customer success, renewal, and AI governance flows
* User stories for each persona and use case
* Configurable workflows
* Validations
* Automations
* Dashboards
* AI features
* Governance expectations

This document must not be implemented all at once. It should be used as a reference document while implementing the CRM phase by phase through the configuration engine.

The CRM must remain configurable. Stages, fields, workflows, approvals, validations, dashboards, roles, notifications, SLA rules, AI rules, and page layouts must not be hard-coded wherever the configuration engine can support them.

---

# 1. CRM Product Vision

The CRM is a production-grade, AI-native, configurable revenue operating system.

It is not only a contact management system. It must support the complete revenue lifecycle from marketing demand generation to lead qualification, opportunity management, proposal, negotiation, closure, onboarding, support, customer success, renewal, expansion, partner sales, executive visibility, and AI governance.

The CRM must be suitable for:

* B2B sales
* SaaS sales
* Enterprise sales
* Channel/partner sales
* Reseller-led deals
* Campaign-led lead generation
* Inside sales
* Field sales
* Presales-led solutioning
* Support-driven customer retention
* Customer success-driven renewal and expansion

---

# 2. Core Design Principles

## 2.1 Configurable First

The CRM must allow administrators to configure:

* Modules
* Objects
* Fields
* Picklists
* Page layouts
* Business process flows
* Workflow automations
* Approval rules
* Notification rules
* SLA rules
* Dashboards
* Reports
* AI use cases
* AI permissions
* Roles and permissions
* Validation rules

without changing code wherever possible.

## 2.2 AI-Native but Governed

AI should be embedded across CRM workflows, but AI must be governed.

AI must support:

* Lead enrichment
* Lead scoring
* Lead intent detection
* Duplicate suggestions
* Meeting summaries
* Call summaries
* Email drafting
* Proposal drafting
* Opportunity risk scoring
* Forecast prediction
* Support ticket classification
* Customer health scoring
* Churn risk alerts
* Expansion recommendations
* Campaign recommendations
* Partner conflict detection
* Executive summaries

AI must not automatically perform sensitive actions unless policy explicitly allows it.

Sensitive AI actions include:

* Sending external emails
* Submitting proposals
* Approving discounts
* Changing contract terms
* Closing opportunities
* Deleting records
* Publishing campaigns
* Approving partner deals
* Making legal commitments

## 2.3 Audit Everything Important

The CRM must maintain audit logs for:

* Record creation
* Record update
* Stage changes
* Owner changes
* Approval decisions
* Field changes
* Configuration changes
* AI actions
* AI recommendations
* AI overrides
* Data imports
* Data exports
* Permission changes

---

# 3. Complete Lead-to-Customer Journey

The standard CRM journey is:

1. Campaign planning
2. Campaign execution
3. Lead capture
4. Lead source attribution
5. Duplicate detection
6. Lead enrichment
7. Lead scoring
8. MQL qualification
9. Lead assignment
10. First contact
11. Follow-up cadence
12. Qualification
13. Meeting/demo booking
14. Lead conversion
15. Account creation or matching
16. Contact creation or matching
17. Opportunity creation
18. Discovery
19. Need analysis
20. Demo or presentation
21. Presales validation
22. Solution fitment
23. Proposal preparation
24. Quote preparation
25. Discount approval
26. Proposal submission
27. Negotiation
28. Legal review
29. Contracting
30. Closed won or closed lost
31. Sales-to-CS handover
32. Onboarding
33. Go-live
34. Adoption monitoring
35. Support management
36. Customer health monitoring
37. Renewal planning
38. Expansion identification
39. Customer advocacy

---

# 4. Core CRM Objects

The CRM must support the following objects:

1. Lead
2. Account
3. Contact
4. Opportunity
5. Campaign
6. Campaign Member
7. Activity
8. Task
9. Meeting
10. Call
11. Email Log
12. Note
13. Product
14. Product Bundle
15. Price Book
16. Quote
17. Proposal
18. Approval Request
19. Contract
20. Partner
21. Partner User
22. Partner Deal Registration
23. Partner Commission
24. Support Ticket
25. SLA
26. Escalation
27. Knowledge Article
28. Customer Success Plan
29. Onboarding Project
30. Onboarding Task
31. Customer Health Score
32. Renewal Opportunity
33. Expansion Opportunity
34. AI Recommendation
35. AI Audit Log
36. Workflow Rule
37. Dashboard Widget
38. User
39. Role
40. Team
41. Territory
42. Business Unit
43. Configuration Version
44. Audit Log

---

# 5. Standard Business Process Flows

## 5.1 Lead Lifecycle BPF

Stages:

1. New Lead
2. Captured
3. Enriched
4. Duplicate Checked
5. Scored
6. Marketing Qualified Lead
7. Assigned
8. Contact Attempted
9. Connected
10. Qualified
11. Nurture
12. Disqualified
13. Converted

### Required Lead Stage Rules

A lead cannot become MQL unless:

* Lead source exists
* Email or phone exists
* Consent status is captured where required
* Lead score exists
* Product interest exists
* Lead owner or assignment rule exists

A lead cannot be converted unless:

* Qualification checklist is complete
* Account/contact duplicate check is done
* Opportunity creation fields are complete
* Owner is assigned
* Next step is defined

A lead cannot be disqualified unless:

* Disqualification reason is selected
* Notes are captured
* Revisit date is captured where future opportunity exists

---

## 5.2 Opportunity Lifecycle BPF

Stages:

1. Created
2. Discovery
3. Need Analysis
4. Demo / Presentation
5. Solution Fitment
6. Presales Validation
7. Proposal Preparation
8. Proposal Submitted
9. Commercial Review
10. Negotiation
11. Legal / Contracting
12. Closed Won
13. Closed Lost
14. Deferred / On Hold

### Required Opportunity Stage Rules

Opportunity cannot move to Demo unless:

* Business need is captured
* Pain points are captured
* Product interest is confirmed
* Decision process is understood

Opportunity cannot move to Proposal unless:

* Discovery is complete
* Product or solution scope is selected
* Stakeholders are identified
* Demo feedback is captured if demo is required

Opportunity cannot move to Negotiation unless:

* Proposal is submitted
* Quote exists
* Commercial terms are captured

Opportunity cannot close won unless:

* Final value is captured
* Contract/PO/payment status is captured
* Handover notes are complete
* Onboarding owner or CSM owner is assigned
* Required approvals are complete

Opportunity cannot close lost unless:

* Loss reason is captured
* Competitor is captured where applicable
* Lessons learned are captured
* Revisit date is captured where applicable

---

## 5.3 Campaign BPF

Stages:

1. Draft
2. Audience Defined
3. Content Prepared
4. Approval Pending
5. Approved
6. Scheduled
7. Live
8. Paused
9. Completed
10. Closed with Report

---

## 5.4 Partner BPF

Stages:

1. Partner Lead Created
2. Partner Evaluated
3. Partner Approved
4. Agreement Signed
5. Portal Access Created
6. Product Training Completed
7. Deal Registration Enabled
8. Active Partner
9. Performance Review
10. Commission Processing
11. Renewal / Termination

---

## 5.5 Support Ticket BPF

Stages:

1. Created
2. Categorized
3. Prioritized
4. Assigned
5. Acknowledged
6. Investigation
7. Waiting on Customer
8. Waiting on Internal Team
9. Escalated
10. Resolved
11. Customer Confirmation
12. Closed
13. Reopened
14. RCA Required
15. Knowledge Article Created

---

## 5.6 Customer Success BPF

Stages:

1. Handover Received
2. Kickoff Scheduled
3. Onboarding Started
4. Configuration in Progress
5. Training in Progress
6. Go-Live Preparation
7. Go-Live Completed
8. Adoption Monitoring
9. Health Review
10. Renewal Planning
11. Expansion Identification
12. Renewal Closed
13. Churn Risk / Recovery

---

# 6. Personas

The CRM must support these personas:

1. Social Media Marketing Executive
2. Digital Marketing Executive
3. Marketing Manager
4. Campaign Manager
5. Marketing Operations / RevOps User
6. Inside Sales Representative
7. Sales Development Representative
8. Business Development Representative
9. Account Executive / Sales Executive
10. Enterprise Sales / Strategic Sales
11. Business Development Manager
12. Sales Manager
13. Sales Head / Revenue Leader
14. Presales Consultant
15. Solution Architect
16. Proposal / Bid Manager
17. Commercial / Finance Approver
18. Legal / Contract Reviewer
19. Partner Manager
20. Reseller / Partner Sales User
21. Support Agent L1
22. Support Agent L2 / Technical Support
23. Support Manager
24. Customer Success Manager — Onboarding
25. Customer Success Manager — Scaled
26. Customer Success Manager — Enterprise
27. Customer / Prospect Portal User
28. CRM Administrator
29. System Administrator
30. AI Governance Manager
31. Data Quality Manager
32. Executive / CEO / CXO

---

# 7. Persona SOPs and User Stories

---

# Persona 1: Social Media Marketing Executive

## SOP Responsibilities

The Social Media Marketing Executive is responsible for creating brand awareness, publishing content, managing social engagement, identifying intent signals, routing inquiries, and converting social interest into CRM leads.

## Standard SOPs

1. Plan social content calendar.
2. Create social media posts.
3. Map every post to campaign, audience, product, and CTA.
4. Publish or schedule approved posts.
5. Track comments, direct messages, mentions, shares, clicks, and reactions.
6. Identify interested prospects.
7. Convert high-intent interactions into CRM leads.
8. Route sales-ready interactions to inside sales.
9. Route low-intent prospects to nurture.
10. Escalate complaints or negative comments to support or management.
11. Track social campaign performance.
12. Use AI to identify buying intent and recommend response.

## User Stories

### SM-001 — Social Content Calendar

As a Social Media Marketing Executive, I want to create a social content calendar inside the CRM so that all social posts are planned, approved, scheduled, and measured.

Acceptance Criteria:

* User can create social post records.
* Each post can be linked to campaign, product, region, audience, and CTA.
* Post status can be draft, approval pending, approved, scheduled, published, paused, or archived.
* AI can recommend posting time, hashtags, and content improvements.
* Manager approval can be required before publishing.

### SM-002 — Social Lead Capture

As a Social Media Marketing Executive, I want to convert social interactions into CRM leads so that interested prospects are not lost.

Acceptance Criteria:

* User can create lead from comment, DM, social form, or mention.
* Lead source is automatically marked as the relevant social channel.
* Campaign and post attribution are stored.
* Duplicate detection runs before creating a lead.
* Consent status is captured if required.

### SM-003 — Social Intent Detection

As a Social Media Marketing Executive, I want AI to classify social interactions so that high-intent prospects are prioritized.

Acceptance Criteria:

* AI classifies interaction as awareness, curiosity, demo request, pricing request, complaint, spam, competitor mention, or support issue.
* High-intent interactions are flagged.
* User can override AI classification.
* AI confidence score is shown.
* AI decision is audit logged.

### SM-004 — Social Response Templates

As a Social Media Marketing Executive, I want approved response templates so that social responses are professional and consistent.

Acceptance Criteria:

* User can select templates.
* AI recommends a response.
* Sensitive complaints can be escalated.
* Responses are logged in CRM timeline.
* Brand-approved messages can be controlled by campaign manager.

### SM-005 — Social Campaign Dashboard

As a Social Media Marketing Executive, I want social campaign dashboards so that I can measure post and channel performance.

Acceptance Criteria:

* Dashboard shows impressions, reach, clicks, engagement, leads, MQLs, opportunities, and revenue.
* User can filter by campaign, channel, product, region, and date.
* AI highlights top-performing and underperforming posts.

---

# Persona 2: Digital Marketing Executive

## SOP Responsibilities

The Digital Marketing Executive manages landing pages, forms, email campaigns, paid campaigns, webinars, website traffic, lead capture, source attribution, and nurture journeys.

## Standard SOPs

1. Create digital campaigns.
2. Configure forms and landing pages.
3. Capture UTM parameters.
4. Launch email campaigns.
5. Track opens, clicks, bounces, unsubscribes, and conversions.
6. Manage webinar registration and attendance.
7. Capture leads into CRM.
8. Run nurture journeys.
9. Pass MQLs to sales.
10. Analyze campaign ROI.

## User Stories

### DM-001 — Landing Page Lead Capture

As a Digital Marketing Executive, I want landing page forms to create leads automatically so that campaign responses are captured in CRM.

Acceptance Criteria:

* Form captures name, email, phone, company, designation, product interest, region, and consent.
* UTM source, medium, campaign, keyword, and content are stored.
* Duplicate detection runs before lead creation.
* Lead source and campaign are auto-populated.
* Auto-response email can be triggered.

### DM-002 — Email Campaign Execution

As a Digital Marketing Executive, I want to create segmented email campaigns so that prospects receive relevant communication.

Acceptance Criteria:

* User can select audience based on persona, region, industry, lifecycle stage, product interest, or engagement.
* Email templates support personalization.
* Campaign approval can be required.
* System tracks opens, clicks, bounces, replies, unsubscribes, and conversions.
* AI suggests subject lines and content variants.

### DM-003 — Webinar Journey

As a Digital Marketing Executive, I want webinar registrations, attendance, and engagement to be captured so that sales can follow up with interested attendees.

Acceptance Criteria:

* Registration creates or updates lead/contact.
* Attendance status is tracked.
* Questions, polls, downloads, and engagement are captured.
* High-engagement attendees can become MQL.
* No-shows can enter nurture sequence.

### DM-004 — Paid Campaign Attribution

As a Digital Marketing Executive, I want paid campaign attribution so that ROI is measured accurately.

Acceptance Criteria:

* Source, medium, campaign, ad group, keyword, creative, and landing page are captured.
* Cost per lead, cost per MQL, cost per SQL, cost per opportunity, and ROI are calculated.
* Multi-touch source history is preserved.
* Campaign dashboard shows spend-to-revenue conversion.

### DM-005 — Lead Nurturing

As a Digital Marketing Executive, I want nurture journeys so that cold or warm leads are developed until they are sales-ready.

Acceptance Criteria:

* Nurture journeys can be configured by persona, product, region, and interest.
* Engagement increases lead score.
* Unengaged leads can be cooled down.
* Sales-ready leads exit nurture automatically.
* AI recommends content for nurture.

---

# Persona 3: Marketing Manager

## SOP Responsibilities

Marketing Manager owns campaign strategy, budget, MQL targets, marketing ROI, campaign approvals, lead quality, and marketing-to-sales alignment.

## Standard SOPs

1. Define marketing strategy.
2. Plan campaigns.
3. Allocate budgets.
4. Approve campaigns.
5. Define MQL rules.
6. Monitor campaign performance.
7. Review MQL quality.
8. Align with sales.
9. Optimize channels.
10. Report marketing contribution to pipeline and revenue.

## User Stories

### MM-001 — Campaign Strategy Planning

As a Marketing Manager, I want to define campaign objectives, budgets, target audience, and expected outcomes so that campaigns are aligned with revenue goals.

Acceptance Criteria:

* Campaign plan includes objective, audience, product, region, budget, owner, timeline, expected leads, MQLs, opportunities, and revenue.
* Campaign approval workflow can be configured.
* Budget utilization is tracked.
* AI recommends channel mix based on past performance.

### MM-002 — MQL Rule Configuration

As a Marketing Manager, I want configurable MQL rules so that only quality leads are passed to sales.

Acceptance Criteria:

* MQL rules can use fit score, engagement score, intent score, lead source, product interest, and persona.
* MQL rules can differ by product or region.
* System logs why a lead became MQL.
* Manual override requires reason.

### MM-003 — Sales Handoff for MQL

As a Marketing Manager, I want MQLs to be handed to sales with full context so that sales can follow up effectively.

Acceptance Criteria:

* Handoff includes source, campaign, engagement history, content downloaded, AI summary, pain point, and recommended opener.
* Sales acceptance or rejection is tracked.
* Rejection reason is mandatory.
* SLA starts when MQL is assigned.

### MM-004 — Marketing ROI Dashboard

As a Marketing Manager, I want campaign ROI dashboards so that marketing spend can be optimized.

Acceptance Criteria:

* Dashboard shows budget, spend, leads, MQLs, SQLs, opportunities, pipeline, wins, revenue, CAC, CPL, and ROI.
* Filters include campaign, channel, product, region, and date.
* AI highlights high-performing and low-performing campaigns.

### MM-005 — Lead Quality Feedback

As a Marketing Manager, I want sales feedback on lead quality so that campaign targeting improves.

Acceptance Criteria:

* Sales can rate lead quality.
* Rejection reasons are tracked.
* Marketing can analyze poor-fit sources.
* AI recommends scoring or targeting improvements.

---

# Persona 4: Campaign Manager

## SOP Responsibilities

Campaign Manager creates, configures, approves, launches, monitors, and closes campaigns for marketing, sales, support, customer success, renewal, events, and partner teams.

## Standard SOPs

1. Create campaign.
2. Define objective.
3. Define audience.
4. Attach assets.
5. Configure journey.
6. Set budget.
7. Route for approval.
8. Launch campaign.
9. Monitor engagement.
10. Route campaign responses.
11. Close campaign with performance report.

## User Stories

### CM-001 — Universal Campaign Creation

As a Campaign Manager, I want to create campaigns for any department so that the CRM supports marketing, sales, partner, support, renewal, and customer success campaigns.

Acceptance Criteria:

* Campaign type is configurable.
* Campaign can be linked to leads, contacts, accounts, opportunities, tickets, renewals, partners, or customer success records.
* Campaign has owner, objective, audience, budget, dates, status, approval status, and expected outcomes.
* Campaign approval rules are configurable.

### CM-002 — Audience Segmentation

As a Campaign Manager, I want to create segmented audiences so that campaigns target the right people.

Acceptance Criteria:

* Segments can use lifecycle stage, industry, geography, product interest, opportunity stage, customer health, renewal date, ticket history, partner tier, and engagement score.
* Audience preview shows count.
* Duplicate suppression is available.
* Consent rules are enforced.

### CM-003 — Campaign Journey Builder

As a Campaign Manager, I want configurable campaign journeys so that communication can be automated.

Acceptance Criteria:

* Journey supports email, call task, SMS placeholder, WhatsApp placeholder, webinar invite, sales alert, partner notification, CSM alert, and nurture step.
* Branching can depend on open, click, reply, attendance, inactivity, score change, or meeting booked.
* AI recommends next step.
* Journey can be paused, cloned, stopped, or completed.

### CM-004 — Campaign Approval

As a Campaign Manager, I want approval workflow for campaigns so that brand, budget, and compliance are controlled.

Acceptance Criteria:

* Approval can depend on campaign type, spend, audience, product, region, and department.
* Approvers can approve, reject, or request revision.
* Campaign cannot go live without required approvals.
* Approval history is audit logged.

### CM-005 — Campaign Closure Report

As a Campaign Manager, I want campaign closure reports so that learning is captured.

Acceptance Criteria:

* Report includes spend, leads, MQLs, SQLs, opportunities, revenue, ROI, conversion rate, learnings, and recommendations.
* AI creates performance summary.
* Campaign can be marked successful, partially successful, or unsuccessful.

---

# Persona 5: Marketing Operations / RevOps User

## SOP Responsibilities

Marketing Operations and RevOps own lifecycle definitions, lead scoring, assignment rules, data quality, attribution, funnel governance, process compliance, and CRM operational reporting.

## Standard SOPs

1. Configure lifecycle stages.
2. Configure lead scoring.
3. Configure assignment rules.
4. Monitor SLA compliance.
5. Maintain campaign attribution.
6. Audit duplicates.
7. Maintain field hygiene.
8. Configure dashboards.
9. Review funnel leakage.
10. Align marketing, sales, and customer success processes.

## User Stories

### MOPS-001 — Lifecycle Configuration

As a RevOps user, I want configurable lifecycle stages so that CRM records move consistently through the funnel.

Acceptance Criteria:

* Lifecycle stages can be configured.
* Stage transitions are logged.
* Rules can be automated or manual.
* Stages can apply to leads, contacts, accounts, opportunities, customers, renewals, and churn states.

### MOPS-002 — Lead Scoring Model

As a Marketing Operations user, I want configurable scoring so that lead priority is transparent.

Acceptance Criteria:

* Scores include fit, engagement, intent, recency, negative signals, and AI prediction.
* Score history is visible.
* AI explains why score changed.
* Scoring rules can differ by product or region.

### MOPS-003 — Lead Routing Rules

As a RevOps user, I want routing rules so that qualified leads reach the right owner.

Acceptance Criteria:

* Routing can use geography, product, segment, industry, company size, language, source, partner, round-robin, named account, or workload.
* Escalation applies if lead is not accepted within SLA.
* Reassignment requires reason.
* Routing history is visible.

### MOPS-004 — Duplicate Management

As a Data/RevOps user, I want duplicate detection and merge workflows so that CRM data stays clean.

Acceptance Criteria:

* Duplicates are detected by email, phone, domain, company name, website, and fuzzy matching.
* Merge rules preserve campaign history, activity history, source history, and audit history.
* Merge requires reason.
* AI recommends likely duplicates.

### MOPS-005 — Funnel Governance Dashboard

As a RevOps user, I want funnel governance dashboards so that process leakage is visible.

Acceptance Criteria:

* Dashboard shows lead aging, SLA breaches, MQL-to-SQL conversion, SQL-to-opportunity conversion, stage stagnation, dropped leads, disqualification reasons, loss reasons, and owner performance.
* AI highlights bottlenecks.
* Records are drillable.

---

# Persona 6: Inside Sales Representative

## SOP Responsibilities

Inside Sales handles inbound leads, first contact, qualification, follow-up cadence, meeting booking, lead disqualification, nurture routing, and handoff to SDR/Sales.

## Standard SOPs

1. Receive assigned lead.
2. Review AI lead summary.
3. Contact lead within SLA.
4. Log call/email/WhatsApp outcomes.
5. Follow cadence.
6. Qualify need, authority, budget, timeline.
7. Schedule meeting/demo.
8. Convert, nurture, or disqualify lead.
9. Maintain follow-up tasks.
10. Escalate hot leads.

## User Stories

### ISR-001 — Assigned Lead Queue

As an Inside Sales Representative, I want a prioritized lead queue so that I can work the most urgent leads first.

Acceptance Criteria:

* Queue shows assigned leads, lead score, SLA due time, source, product, last activity, and priority.
* Hot leads are highlighted.
* AI recommends best contact time and channel.
* User can open AI lead summary.

### ISR-002 — First Contact Workflow

As an Inside Sales Representative, I want guided first-contact scripts so that qualification is consistent.

Acceptance Criteria:

* Script changes by product, campaign, source, and persona.
* User can log outcome as connected, not answered, wrong number, interested, not interested, callback requested, meeting booked, or disqualified.
* AI summarizes call notes.
* Next step is created automatically.

### ISR-003 — Contact Cadence

As an Inside Sales Representative, I want automated contact cadence so that no lead is missed.

Acceptance Criteria:

* Cadence includes call, email, SMS/WhatsApp placeholder, LinkedIn/manual touch, and follow-up tasks.
* Cadence can be paused with reason.
* After failed attempts, lead can move to nurture.
* SLA breach alerts are triggered.

### ISR-004 — Basic Qualification

As an Inside Sales Representative, I want a qualification checklist so that I know whether a lead is sales-ready.

Acceptance Criteria:

* Checklist captures need, product interest, organization type, location, decision authority, budget range, timeline, current solution, and meeting interest.
* Required fields must be completed before marking lead qualified.
* AI suggests qualification outcome.
* User can override AI with reason.

### ISR-005 — Meeting Booking

As an Inside Sales Representative, I want to schedule meetings from the lead record so that qualified leads can move forward.

Acceptance Criteria:

* User can book meeting with sales, presales, or manager.
* Meeting invite includes agenda, participants, and CRM record link.
* Lead status changes to meeting scheduled.
* Reminder tasks are created.

### ISR-006 — Lead Disqualification

As an Inside Sales Representative, I want structured disqualification so that bad-fit leads do not pollute pipeline.

Acceptance Criteria:

* Disqualification reason is mandatory.
* Reasons include no budget, no authority, invalid contact, wrong geography, duplicate, spam, not interested, future need, competitor, or irrelevant.
* Future-fit leads can be routed to nurture.
* Disqualified leads are excluded from active SLA.

---

# Persona 7: Sales Development Representative

## SOP Responsibilities

SDR performs deeper qualification, account research, discovery, buying committee identification, pain validation, meeting setting, and opportunity creation.

## Standard SOPs

1. Research lead/account.
2. Validate ICP fit.
3. Conduct discovery call.
4. Identify buying committee.
5. Capture pain, urgency, and need.
6. Capture qualification framework.
7. Convert to opportunity.
8. Assign opportunity owner.
9. Handover context.
10. Recycle or disqualify unfit leads.

## User Stories

### SDR-001 — AI Account Research

As an SDR, I want AI-assisted account research so that I understand the prospect before outreach.

Acceptance Criteria:

* AI summarizes company profile, industry, size, leadership, locations, likely needs, recent signals, and talking points.
* Research sources are logged.
* User can save insights.
* AI confidence is visible.

### SDR-002 — ICP Fit Assessment

As an SDR, I want ICP fit scoring so that I prioritize the right accounts.

Acceptance Criteria:

* ICP score uses industry, segment, size, geography, use case, budget, and strategic value.
* Fit is high, medium, or low.
* Low-fit leads can be nurtured or disqualified.
* AI explains the score.

### SDR-003 — Discovery Call

As an SDR, I want a structured discovery form so that important qualification data is captured.

Acceptance Criteria:

* Form captures pain, current process, vendor, urgency, budget, authority, timeline, decision process, stakeholders, success criteria, and risks.
* AI summarizes call.
* Required fields are enforced before opportunity creation.
* Follow-up email can be generated.

### SDR-004 — Convert Lead to Opportunity

As an SDR, I want to convert qualified leads into opportunities so that the sales pipeline begins.

Acceptance Criteria:

* System creates or links account and contact.
* Opportunity is created with product, estimated value, stage, close date, source, owner, and qualification summary.
* Duplicate detection runs.
* Handover task is created.
* Lead status becomes converted.

### SDR-005 — No-Show Workflow

As an SDR, I want a no-show workflow so that missed meetings are handled consistently.

Acceptance Criteria:

* User can mark meeting as no-show.
* Reschedule email/task is created.
* After configured no-shows, lead moves to nurture or disqualified.
* No-show count is tracked.

### SDR-006 — Objection Capture

As an SDR, I want to capture objections so that future sales conversations are stronger.

Acceptance Criteria:

* Objections include price, timing, competitor, authority, feature gap, integration, security, implementation, and unclear need.
* AI recommends objection-handling content.
* Objection trends are reportable.

---

# Persona 8: Business Development Representative

## SOP Responsibilities

BDR handles outbound prospecting, target account lists, cold outreach, account penetration, event follow-ups, partner referrals, and enterprise opportunity creation.

## Standard SOPs

1. Build target account list.
2. Research accounts.
3. Identify buyer personas.
4. Create outbound sequences.
5. Execute outreach.
6. Track engagement.
7. Qualify interest.
8. Book meetings.
9. Create opportunities.
10. Develop strategic relationships.

## User Stories

### BDR-001 — Target Account List

As a BDR, I want to create target account lists so that outbound work is focused.

Acceptance Criteria:

* Accounts can be added manually or imported.
* Accounts are segmented by region, industry, size, revenue, technology, and priority.
* AI recommends high-potential accounts.
* Duplicate checks run during import.

### BDR-002 — Contact Discovery

As a BDR, I want to map contacts within an account so that I reach the right stakeholders.

Acceptance Criteria:

* Contacts can be tagged as decision maker, influencer, evaluator, procurement, finance, technical, user, or executive.
* AI suggests missing buying committee roles.
* Contact completeness score is visible.

### BDR-003 — Outbound Sequence

As a BDR, I want configurable outbound sequences so that prospecting is structured.

Acceptance Criteria:

* Sequence supports email, call, LinkedIn/manual touch, WhatsApp/SMS placeholder, and task reminders.
* Sequence steps are configurable by persona, product, and region.
* Replies pause sequence.
* AI suggests personalized messages.

### BDR-004 — Account Engagement Score

As a BDR, I want account engagement scoring so that I identify accounts showing buying signals.

Acceptance Criteria:

* Score aggregates opens, clicks, website visits, event attendance, replies, meetings, and stakeholder engagement.
* AI highlights accounts with buying signals.
* User can convert engaged account into opportunity.

### BDR-005 — Strategic Account Handoff

As a BDR, I want to hand over strategic opportunities to enterprise sales so that large accounts are managed properly.

Acceptance Criteria:

* Handover includes research, stakeholder map, pain points, engagement history, recommended approach, and next meeting.
* Sales owner receives notification.
* Manager can approve reassignment.

---

# Persona 9: Account Executive / Sales Executive

## SOP Responsibilities

Sales Executive owns qualified opportunities, discovery, stakeholder mapping, demo coordination, proposal, negotiation, deal closure, and customer handoff.

## Standard SOPs

1. Accept assigned opportunity.
2. Review handover.
3. Conduct discovery.
4. Map stakeholders.
5. Coordinate demo/presales.
6. Prepare proposal.
7. Handle objections.
8. Negotiate commercials.
9. Close won/lost.
10. Handover to onboarding/customer success.

## User Stories

### AE-001 — Opportunity Acceptance

As a Sales Executive, I want to accept or reject assigned opportunities so that ownership is clear.

Acceptance Criteria:

* User can accept opportunity.
* User can reject with reason.
* Rejected opportunity returns to SDR/manager queue.
* Acceptance starts sales SLA.
* Acceptance is audit logged.

### AE-002 — Opportunity Workspace

As a Sales Executive, I want a complete opportunity workspace so that I can manage the deal from one place.

Acceptance Criteria:

* Workspace shows account, contacts, activities, emails, calls, notes, tasks, stage, value, probability, close date, products, competitors, risks, proposals, and AI insights.
* User can update stage.
* Mandatory fields are enforced by stage.
* AI recommends next action.

### AE-003 — Stakeholder Mapping

As a Sales Executive, I want to map stakeholders so that I understand the buying committee.

Acceptance Criteria:

* Contacts can be tagged by role in decision process.
* Influence level, sentiment, and relationship strength can be captured.
* Missing stakeholder alerts are shown.
* AI recommends engagement strategy.

### AE-004 — Discovery and Need Analysis

As a Sales Executive, I want structured discovery capture so that the solution matches customer needs.

Acceptance Criteria:

* User captures business problem, current process, urgency, success metrics, budget, timeline, decision criteria, procurement process, and risks.
* AI summarizes discovery.
* Discovery completeness score is shown.
* Opportunity cannot move forward if critical fields are missing.

### AE-005 — Demo Request to Presales

As a Sales Executive, I want to request presales support so that the customer gets a relevant demo.

Acceptance Criteria:

* Demo request includes customer use case, audience, pain points, modules, desired outcome, and date.
* Presales owner is assigned.
* Demo status is tracked.
* Demo feedback updates opportunity.

### AE-006 — Proposal Generation

As a Sales Executive, I want to generate proposals from CRM data so that proposals are faster and accurate.

Acceptance Criteria:

* Proposal pulls account, contact, scope, product, pricing, timeline, terms, assumptions, and exclusions.
* Templates are configurable.
* AI drafts executive summary and solution narrative.
* Approval is required for discounts or non-standard terms.

### AE-007 — Discount Request

As a Sales Executive, I want to request discounts inside the opportunity so that approvals are governed.

Acceptance Criteria:

* Request includes discount, justification, competitor context, margin impact, value, and close probability.
* Approval route depends on threshold.
* Opportunity cannot close won with unapproved discount.
* Approval history is visible.

### AE-008 — Negotiation Tracking

As a Sales Executive, I want to track negotiation points so that risks and commitments are clear.

Acceptance Criteria:

* User captures commercial asks, legal asks, procurement blockers, competitor offers, final price, and next action.
* AI identifies risk.
* Manager can view negotiation history.

### AE-009 — Close Won

As a Sales Executive, I want to close an opportunity as won so that onboarding starts.

Acceptance Criteria:

* Required fields include final value, contract status, PO/payment status, billing terms, start date, implementation scope, onboarding owner, and handover note.
* Closed won triggers onboarding project.
* CSM owner is assigned.
* Forecast is updated.

### AE-010 — Close Lost

As a Sales Executive, I want to close opportunities as lost with structured reasons so that the company learns.

Acceptance Criteria:

* Loss reason is mandatory.
* Competitor is captured where applicable.
* Future revisit date can be set.
* AI summarizes lessons learned.
* Lost opportunity can be reactivated with approval.

---

# Persona 10: Enterprise Sales / Strategic Sales

## SOP Responsibilities

Enterprise Sales manages complex strategic deals with long sales cycles, multiple stakeholders, executive engagement, RFP/tender processes, security review, legal review, and phased closure.

## Standard SOPs

1. Create strategic account plan.
2. Map business units.
3. Map stakeholders.
4. Conduct executive discovery.
5. Coordinate presales and solution architect.
6. Manage RFP/tender process.
7. Build commercial structure.
8. Manage legal/procurement.
9. Close phased deals.
10. Transition to enterprise CSM.

## User Stories

### ES-001 — Strategic Account Plan

As an Enterprise Sales user, I want account plans so that strategic accounts are managed systematically.

Acceptance Criteria:

* Plan includes account overview, business units, stakeholders, systems, pain points, opportunities, competitors, revenue potential, risks, and action plan.
* AI generates whitespace analysis.
* Manager can review plan.

### ES-002 — Multi-Opportunity Account Management

As an Enterprise Sales user, I want multiple opportunities under one account so that departments, regions, or phases are tracked separately.

Acceptance Criteria:

* Account can have multiple opportunities.
* Parent-child opportunity structure is supported.
* Roll-up pipeline value is visible.
* Forecast can include phased closure.

### ES-003 — RFP / Tender Tracking

As an Enterprise Sales user, I want to track RFP/tender opportunities so that deadlines and compliance are controlled.

Acceptance Criteria:

* Tender number, issuing authority, deadline, eligibility, scope, pre-bid date, EMD, commercial format, and checklist are captured.
* Tasks are generated for sales, bid, presales, legal, finance, and leadership.
* Missing documents are flagged.
* AI summarizes tender requirements.

### ES-004 — Executive Engagement

As an Enterprise Sales user, I want to track executive meetings so that strategic engagement is visible.

Acceptance Criteria:

* CXO contacts can be tagged.
* Meeting notes, commitments, and follow-ups are captured.
* AI suggests executive talking points.
* Sales leader sees executive engagement score.

### ES-005 — Strategic Deal Governance

As an Enterprise Sales user, I want governance checkpoints for large deals so that risk is managed.

Acceptance Criteria:

* Deal review required above configured value threshold.
* Review captures solution fit, pricing, legal, risk, delivery readiness, and leadership support.
* Deal cannot move to final negotiation if review is incomplete.
* Approval history is audit logged.

---

# Persona 11: Business Development Manager

## SOP Responsibilities

BDM owns market development, territory planning, strategic partnerships, partner referrals, new business opportunities, pipeline creation, and market intelligence.

## Standard SOPs

1. Identify market segments.
2. Build territory plan.
3. Generate strategic leads.
4. Coordinate campaigns.
5. Develop partner ecosystem.
6. Track pipeline creation.
7. Support deal strategy.
8. Review conversion outcomes.
9. Capture market intelligence.
10. Create expansion strategy.

## User Stories

### BDM-001 — Territory Plan

As a BDM, I want territory plans so that growth efforts are structured.

Acceptance Criteria:

* Territory plan includes geography, target segments, named accounts, partner coverage, campaigns, pipeline target, and revenue target.
* AI suggests high-potential segments.
* Sales Head can review plan.

### BDM-002 — Market Intelligence

As a BDM, I want to capture market intelligence so that strategy improves.

Acceptance Criteria:

* User can log competitor insights, pricing signals, objections, customer trends, and opportunities.
* Insights link to accounts, opportunities, or campaigns.
* AI clusters recurring market signals.

### BDM-003 — Partner Referral Tracking

As a BDM, I want partner referrals tracked so that partner-sourced pipeline is visible.

Acceptance Criteria:

* Referral source is captured.
* Referral is linked to partner account.
* Conversion and revenue are tracked.
* Commission eligibility can be flagged.

### BDM-004 — Strategic Opportunity Creation

As a BDM, I want to create strategic opportunities from account research so that new market opportunities enter pipeline.

Acceptance Criteria:

* Opportunity can be created from target account.
* Source is marked business development.
* Required fields include use case, product, estimated value, priority, and next action.
* Sales owner is assigned.

---

# Persona 12: Sales Manager

## SOP Responsibilities

Sales Manager manages team pipeline, lead SLA, follow-up discipline, opportunity reviews, coaching, approvals, forecast accuracy, reassignment, and performance.

## Standard SOPs

1. Review team pipeline.
2. Monitor lead follow-up SLA.
3. Review stagnant opportunities.
4. Conduct deal reviews.
5. Approve discounts within authority.
6. Coach reps.
7. Reassign records.
8. Review forecast.
9. Analyze win/loss.
10. Escalate strategic deals.

## User Stories

### SMGR-001 — Team Pipeline Dashboard

As a Sales Manager, I want team pipeline dashboards so that I can manage opportunities by stage, owner, value, and risk.

Acceptance Criteria:

* Dashboard shows pipeline, weighted pipeline, stage value, owner pipeline, aging, close date, forecast category, and risk.
* Manager can drill down.
* AI highlights high-risk deals.

### SMGR-002 — Lead SLA Monitoring

As a Sales Manager, I want to monitor lead SLAs so that leads are not wasted.

Acceptance Criteria:

* Dashboard shows assigned leads, accepted leads, overdue first contact, untouched leads, and SLA breaches.
* Manager can reassign leads.
* Reassignment reason is logged.
* Escalation notifications are generated.

### SMGR-003 — Deal Review

As a Sales Manager, I want structured deal reviews so that coaching is consistent.

Acceptance Criteria:

* Review includes stage, close date, next step, stakeholders, competitor, risks, blockers, probability, and manager comments.
* AI suggests coaching points.
* Review history is saved.

### SMGR-004 — Discount Approval

As a Sales Manager, I want to approve discounts within my authority so that deals move quickly with governance.

Acceptance Criteria:

* Request shows value, discount, margin impact, justification, and competitor context.
* Manager can approve, reject, or request revision.
* Decision is audit logged.

### SMGR-005 — Forecast Review

As a Sales Manager, I want to review forecasts so that expected revenue is reliable.

Acceptance Criteria:

* Reps submit forecast category.
* Manager can adjust with reason.
* System compares forecast to actual.
* AI flags unrealistic close dates and probabilities.

### SMGR-006 — Performance Coaching

As a Sales Manager, I want coaching insights so that rep performance improves.

Acceptance Criteria:

* Report shows conversion rate, activity volume, average deal size, win rate, cycle time, stage leakage, and follow-up discipline.
* AI recommends coaching focus.
* Manager can create coaching tasks.

---

# Persona 13: Sales Head / Revenue Leader

## SOP Responsibilities

Sales Head owns revenue targets, quotas, pipeline governance, forecast, strategic deal review, pricing governance, win/loss analysis, and executive reporting.

## Standard SOPs

1. Define revenue targets.
2. Assign quotas.
3. Review pipeline health.
4. Review forecast.
5. Monitor campaign contribution.
6. Review strategic deals.
7. Approve high discounts.
8. Analyze win/loss.
9. Review team performance.
10. Present executive report.

## User Stories

### SH-001 — Revenue Dashboard

As a Sales Head, I want executive revenue dashboards so that I can track revenue performance.

Acceptance Criteria:

* Dashboard shows target, achieved revenue, pipeline, weighted forecast, gap, win rate, average deal size, sales cycle, and renewal pipeline.
* Filters include region, product, team, segment, and period.
* AI summarizes revenue risks and opportunities.

### SH-002 — Quota Management

As a Sales Head, I want quota management so that performance can be measured.

Acceptance Criteria:

* Quotas can be set by month, quarter, year, product, region, and owner.
* Quota attainment is tracked.
* Hierarchy roll-up is supported.
* AI predicts quota risk.

### SH-003 — Strategic Deal Review Board

As a Sales Head, I want strategic deal reviews so that large opportunities get leadership attention.

Acceptance Criteria:

* Deals above threshold enter review.
* Review includes executive sponsor, business case, competitive risk, commercials, delivery risk, legal status, and next action.
* Leadership comments are logged.
* AI suggests executive intervention.

### SH-004 — Win/Loss Analytics

As a Sales Head, I want win/loss analytics so that sales strategy improves.

Acceptance Criteria:

* Dashboard shows reasons by competitor, price, features, timeline, geography, rep, product, and segment.
* AI identifies patterns.
* Lost deals can be assigned for revival.

### SH-005 — Sales Process Governance

As a Sales Head, I want to approve changes to sales stages and mandatory fields so that process changes are governed.

Acceptance Criteria:

* RevOps can propose process changes.
* Sales Head approves or rejects.
* Approved changes are versioned.
* Users are notified.

---

# Persona 14: Presales Consultant

## SOP Responsibilities

Presales supports discovery, demo, POC, solution fitment, RFP responses, proposal inputs, technical validation, and customer objections.

## Standard SOPs

1. Receive demo/solution request.
2. Review customer context.
3. Prepare demo script.
4. Conduct demo.
5. Capture questions and gaps.
6. Provide solution recommendation.
7. Support proposal.
8. Estimate effort.
9. Flag risks.
10. Support final negotiation.

## User Stories

### PS-001 — Presales Request Queue

As a Presales Consultant, I want a queue of demo and solution requests so that I can prioritize support.

Acceptance Criteria:

* Queue shows opportunity, customer, sales owner, request type, due date, priority, product, and stage.
* AI summarizes opportunity context.
* User can accept, reject, or request more information.

### PS-002 — Demo Preparation

As a Presales Consultant, I want a demo workspace so that demos are tailored.

Acceptance Criteria:

* Workspace includes pain points, use cases, audience, modules, competitors, objections, and expected outcome.
* AI suggests demo flow.
* Demo checklist is configurable.

### PS-003 — Demo Feedback

As a Presales Consultant, I want to capture demo feedback so that sales knows customer response.

Acceptance Criteria:

* Feedback includes attendees, modules shown, questions, objections, positive signals, gaps, and next steps.
* AI summarizes sentiment.
* Opportunity stage can be updated.

### PS-004 — Solution Fitment

As a Presales Consultant, I want to document fitment so that proposal is technically accurate.

Acceptance Criteria:

* User captures fit, partial fit, gap, customization, integration, dependency, and risk.
* Gaps can become tasks or change requests.
* Sales and architect can review.

### PS-005 — POC Management

As a Presales Consultant, I want to manage POC activities so that validation is tracked.

Acceptance Criteria:

* POC plan includes objective, scope, success criteria, timeline, responsibilities, demo data, and sign-off.
* Tasks are assigned.
* Customer feedback and sign-off are captured.
* POC outcome updates opportunity probability.

---

# Persona 15: Solution Architect

## SOP Responsibilities

Solution Architect manages technical discovery, architecture, integration feasibility, security responses, scalability review, implementation approach, delivery risk, and technical approval.

## Standard SOPs

1. Review opportunity and scope.
2. Assess customer environment.
3. Identify integrations.
4. Define solution architecture.
5. Validate security and compliance.
6. Estimate complexity.
7. Support proposal/RFP.
8. Review delivery risk.
9. Approve architecture.
10. Support handover.

## User Stories

### SA-001 — Technical Discovery

As a Solution Architect, I want technical discovery forms so that solution design is accurate.

Acceptance Criteria:

* Discovery captures systems, integrations, APIs, authentication, data migration, hosting, security, compliance, users, concurrency, reporting, and custom workflows.
* AI extracts requirements from notes/documents.
* Missing technical fields are flagged.

### SA-002 — Architecture Recommendation

As a Solution Architect, I want architecture recommendation support so that complex deals are designed consistently.

Acceptance Criteria:

* Architecture includes frontend, backend, database, integrations, AI layer, analytics, security, deployment, and support.
* AI drafts architecture based on requirements.
* Architect can edit and approve.
* Approved architecture links to proposal.

### SA-003 — Integration Assessment

As a Solution Architect, I want to assess integrations so that scope and effort are clear.

Acceptance Criteria:

* User captures integration system, method, API availability, authentication, frequency, data direction, complexity, owner, and risk.
* Effort is estimated.
* Risks are visible in opportunity.

### SA-004 — Security Questionnaire

As a Solution Architect, I want to answer security questionnaires using approved knowledge so that responses are accurate.

Acceptance Criteria:

* User can upload or enter questions.
* AI suggests answers from approved knowledge base.
* Answers require architect approval.
* Version history is maintained.

### SA-005 — Delivery Risk Approval

As a Solution Architect, I want to approve or flag delivery risk before closure so that risky deals are controlled.

Acceptance Criteria:

* Risks include scope ambiguity, integration complexity, timeline risk, customization, data migration, security, compliance, and resource availability.
* High-risk deals require leadership approval.
* Risk status is linked to opportunity.

---

# Persona 16: Proposal / Bid Manager

## SOP Responsibilities

Pr

<!-- ============================================================
     END OF PASTED CONTENT (PART 1).
     The source message was TRUNCATED here by a 50,000-character
     message limit, mid Persona 16 (Proposal / Bid Manager),
     right after "## SOP Responsibilities".

     PENDING (not yet provided): the rest of Persona 16 and
     Personas 17–32, plus any remaining sections (e.g. configurable
     workflows, validations, automations, dashboards, AI features,
     governance appendices).

     Paste the remainder and it will be appended here verbatim,
     replacing this marker.
     ============================================================ -->
