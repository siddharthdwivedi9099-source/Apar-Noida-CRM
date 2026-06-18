# Enterprise Customer Success Playbook

## Purpose

This playbook guides the Customer Success Manager – Enterprise and the Customer Success Head through the enterprise motion implemented in Phase 16.

## Scope

Enterprise accounts are customer success accounts in the `enterprise` segment. The enterprise workspace (`GET /customer-success/workspaces/enterprise`) surfaces accounts, open escalations, tracked QBR/EBR sessions, expansion opportunities, and total contract value.

## Motion

1. **Maintain a strategic success plan** (`PUT .../success-plan`) with objective, value realization, executive sponsor, stakeholder map, expansion opportunities, and renewal strategy.
2. **Map stakeholders** with name, title, role, and sentiment to track executive relationships.
3. **Run QBR/EBR cadence** (`POST .../qbrs`) capturing summary, outcomes, and next steps; update status as sessions complete.
4. **Operate an enterprise risk register** via escalations (`POST .../escalations`) with severity and status; resolving an escalation records its resolution time.
5. **Track value realization and expansion** to inform renewal strategy.
6. **Plan renewals** with forecast value, probability, and a documented strategy.

## Signals to watch

- Open critical escalations
- Stalled QBR/EBR cadence
- Low or declining executive sentiment
- High-value renewals approaching without a committed strategy

## AI placeholders

QBR/EBR summary, executive account brief, and renewal strategy recommendation placeholders are available to roles with AI usage permission.
