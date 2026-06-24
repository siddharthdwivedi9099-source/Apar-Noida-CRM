# Using the CRM for the Education Ecosystem (and IT Service Projects)

This guide explains how to capture and work the two lead types the platform now supports, with a focus on the **eLite SIS education ecosystem**.

## 1. The two lead types

Every lead now starts with a **Lead For** classification:

| Lead For | Use it for | Then choose |
|----------|------------|-------------|
| **IT Service Project** | Custom IT development engagements (the lead is usually a company) | **Technologies** (multi-select) |
| **Product** | Education-ecosystem product sales (the lead is an institution) | **Products** (multi-select) |

The lead form shows the relevant multi-select **conditionally**: pick *IT Service Project* and you choose technologies; pick *Product* and you choose products. The choice and selections are stored on the lead and carried forward to the opportunity.

## 2. The eLite SIS product catalog

| Product (option key) | What it is | Best-fit institutions |
|----------------------|------------|------------------------|
| **eLite SIS K12** (`elite_sis_k12`) | School ERP | Pre-schools, K12 schools |
| **eLite SIS Learn** (`elite_sis_learn`) | Learning Management System | All institutions (cross-sell) |
| **eLite SIS Higher Ed** (`elite_sis_higher_ed`) | Higher-education ERP | Colleges, universities |
| **eLite SIS CI** (`elite_sis_ci`) | Coaching-institute ERP | Coaching institutes, tuition centres |
| **eLite SIS PI** (`elite_sis_pi`) | Professional-studies ERP | Professional-studies institutions, vocational colleges |

> **The product list is configurable.** Add, rename, or retire products in **Admin → Option Sets → "Education Product"** (`education-product` set). New products appear in the lead form's Product multi-select immediately — no code change. The same applies to the **Service Technology** (`service-technology`) and **Lead For** (`lead-for`) sets.

## 3. Education lead targets → recommended product fit

| Institution type (segment) | Recommended products |
|----------------------------|----------------------|
| Pre-school | eLite SIS K12 + eLite SIS Learn |
| K12 school | eLite SIS K12 + eLite SIS Learn |
| College | eLite SIS Higher Ed + eLite SIS Learn |
| University | eLite SIS Higher Ed + eLite SIS Learn |
| Coaching institute | eLite SIS CI + eLite SIS Learn |
| Tuition centre | eLite SIS CI + eLite SIS Learn |
| Professional-studies institution | eLite SIS PI + eLite SIS Learn |
| Vocational study college | eLite SIS PI + eLite SIS Learn |

(eLite SIS Learn is the natural cross-sell across every segment.)

## 4. Capturing a lead

### A product (education) lead
1. Go to **Leads → New** (`/leads/new`).
2. Fill the contact and company (the institution) details.
3. Set **Lead For = Product**.
4. In **Products**, select all the eLite products that fit (e.g., a university → *eLite SIS Higher Ed* + *eLite SIS Learn*).
5. Save. The classification shows on the lead detail under **Lead classification**.

### An IT service-project lead
1. **Leads → New**; fill the company/contact.
2. Set **Lead For = IT Service Project**.
3. In **Technologies**, select all that apply (e.g., *Web Development*, *Cloud & DevOps*, *AI & Machine Learning*).
4. Save.

## 5. How it flows through the system

- **Lead list** (`/leads`): filter by **Lead For** and **Product** (and status, source, owner). Example: show only *eLite SIS CI* prospects to plan a coaching-segment campaign.
- **Lead detail**: the **Lead classification** card shows the type and the selected technologies/products.
- **Opportunity**: when a lead becomes an opportunity, the classification is carried in the opportunity's metadata and shown on the opportunity detail under **Lead classification (carried from the lead)** — so pipeline reviews keep the product/technology context.
- **API**: `GET /leads?leadFor=product&product=elite_sis_k12` (and `technology=...`) filter server-side on the stored classification.

## 6. Demo dataset (216 education leads)

A ready-made dataset is provided so you can explore immediately.

- **216 leads** — 27 per segment across all 8 institution types (pre-school → vocational), each tagged with its best-fit products. **All 5 products are represented.**
- **24 accounts + 24 opportunities** — a sample converted to show the pipeline.

**Seed it** (after the core seed):
```bash
npm run db:seed            # ensures the new option sets exist
npm run db:seed:education  # inserts the 216 leads + accounts + opportunities
```
The education seed is **idempotent** — re-running replaces the `education-demo` batch rather than duplicating it. The script lives at `scripts/seed-education.mjs`; adjust counts, segments, or product mappings there.

**Explore it:**
- Leads list → filter **Product = eLite SIS Higher Ed** to see colleges/universities.
- Leads list → filter **Lead For = Product** to see the whole education book.
- Open any seeded lead to see its **Lead classification** card; open a seeded opportunity to see the carried classification.

## 7. Reporting & segmentation tips

- Use the **Product** and **Lead For** filters to build segment views (e.g., all coaching prospects).
- Because the values live in each lead's metadata and in the configurable option sets, renaming a product in Admin updates its label everywhere it is displayed.
- Pair with **Campaigns** to run product-specific outreach (e.g., a K12 ERP campaign targeting pre-schools and schools).

## 8. Where things live (for admins/developers)

| Concern | Location |
|---------|----------|
| Option sets (lead-for, service-technology, education-product) | `packages/types/src/tenant-config.ts` → `defaultTenantOptionSetDefinitions` (seeded; editable in Admin) |
| Lead form fields | `apps/web/src/pages/lead-form-page.tsx` |
| Lead/opportunity classification display | `apps/web/src/pages/lead-detail-page.tsx`, `opportunity-detail-page.tsx` |
| Server filters | `apps/api/src/modules/crm/crm.service.ts` (`listLeads`), `crm.router.ts` (`leadListQuerySchema`) |
| Demo data seeder | `scripts/seed-education.mjs` (`npm run db:seed:education`) |

See also the [Full User Manual](./USER_MANUAL.md) and the [Documentation Index](../DOCUMENTATION_INDEX.md).
