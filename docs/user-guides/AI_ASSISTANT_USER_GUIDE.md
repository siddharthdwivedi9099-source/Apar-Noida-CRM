# AI Assistant User Guide

## Purpose

This guide explains the AI features available to users across the CRM, introduced through the AI Gateway (Phase 18), Prompt Registry and Agent Registry (Phase 19), RAG knowledge (Phase 20), the Customer Query bot (Phase 21), and module AI actions (Phase 22).

## AI workspaces

- **AI Assistant** (`/ai-assistant`) — run governed prompt templates through the AI Gateway and review provider, settings, and usage logs.
- **Prompt Registry** (`/ai-prompts`) — manage versioned, approval-gated prompts.
- **Agent Registry** (`/ai-agents`) — view and configure governed AI agents.
- **Knowledge Base** (`/knowledge`) and **RAG Console** (`/knowledge/rag-console`) — manage the approved knowledge corpus and test retrieval.
- **AI Actions** (`/ai-actions`) — run module-specific AI actions.

## Using AI Actions (Phase 22)

The **AI Actions** page lists AI actions for every CRM module — Leads, Accounts, Opportunities, Campaigns, Social, Support, Customer Success, Training, Partners, and Resellers.

1. **Filter by module** and pick an action (for example *Lead summary*, *Opportunity summary*, *Suggested response*, or *Renewal strategy suggestion*).
2. **Provide inputs** — each action shows the fields its prompt needs. Prompts come from the managed Prompt Registry; they are never typed in the UI.
3. **Run** — the action executes through the AI Gateway. The result shows the provider, model, and output. Live generation is deferred, so results are governed placeholders today.
4. **Review** — sensitive actions (drafts, recommendations, and generators — for example *Follow-up email draft*, *Proposal draft outline*, *Email copy generator*) are marked **Review** and come back as *pending review*. An authorized reviewer approves or rejects the output before it is used.

Actions you don't have permission for are shown as **No access** and cannot be run.

## What's governed

- **Permissions** — every action checks your module permission (or an AI permission) before running.
- **Logging** — every action's request and response is logged (`ai_action_runs`) along with the gateway usage log.
- **Prompt Registry** — every action resolves its prompt from the managed registry; no prompts are hardcoded in the UI.
- **Human review** — sensitive outputs require approval before use.

See [../ai/AI_USE_CASE_CATALOG.md](../ai/AI_USE_CASE_CATALOG.md) for the full action list and [../ai/AI_GOVERNANCE.md](../ai/AI_GOVERNANCE.md) for the governance model.
