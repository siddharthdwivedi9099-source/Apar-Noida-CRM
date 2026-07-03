import type { PoolClient } from "pg";
import type {
  AgentEnvelope,
  AiAgentKind,
  AiAgentRunResponse,
  AiAgentRunsResponse,
  AiAgentRunSummary,
  DecideAgentRunRequestBody,
  RunAgentRequestBody
} from "@crm/types";
import {
  aiAgentKinds,
  aiAgentRunStatuses,
  assessOpportunityRisk,
  computeHealthScore,
  draftEmail,
  draftProposal,
  enrichLead,
  flagLowConfidence,
  forecastOpportunity,
  humanReviewAgents,
  rankKnowledgeArticles,
  resolveAiExplanation,
  scoreLead,
  suggestTicketClassification,
  summarizeCall
} from "@crm/types";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";

interface ActorContext {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
}

interface AuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

function normalize<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

const AGENT_ENTITY: Partial<Record<AiAgentKind, string>> = {
  lead_enrichment: "lead",
  lead_scoring: "lead",
  proposal_drafting: "opportunity",
  opportunity_risk: "opportunity",
  forecasting: "opportunity",
  support_triage: "ticket",
  customer_health: "customer_success_account"
};

export class AiAgentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "AI agents are unavailable until the database connection is enabled.", undefined, "AI_AGENTS_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId?: string | null; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, 'ai', $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [actor.tenantId, actor.userId, input.action, input.resourceType, input.resourceId ?? null, input.status, audit.ipAddress, audit.userAgent, JSON.stringify(input.metadata ?? {})]
    );
  }

  // Build the governed envelope for the requested agent by gathering the entity's signals.
  private async runResolver(client: PoolClient, tenantId: string, kind: AiAgentKind, entityId: string | null, input: Record<string, unknown>): Promise<AgentEnvelope<unknown>> {
    switch (kind) {
      case "lead_enrichment": {
        const lead = await this.loadLead(client, tenantId, entityId);
        return enrichLead({ companyName: lead.company_name, firstName: lead.first_name, lastName: lead.last_name, email: lead.email, industryHint: typeof input.industryHint === "string" ? input.industryHint : null });
      }
      case "lead_scoring": {
        const lead = await this.loadLead(client, tenantId, entityId);
        const meta = (lead.metadata ?? {}) as Record<string, unknown>;
        const num = (k: string, fallback: number) => (typeof meta[k] === "number" ? (meta[k] as number) : typeof input[k] === "number" ? (input[k] as number) : fallback);
        return scoreLead({ icpFit: num("icpFit", lead.score ?? 50), engagement: num("engagement", 50), seniority: num("seniority", 50), budgetSignal: num("budgetSignal", 50), recency: num("recency", 50), negativeSignals: typeof input.negativeSignals === "number" ? (input.negativeSignals as number) : 0 });
      }
      case "email_drafting":
        return draftEmail({ recipientName: typeof input.recipientName === "string" ? input.recipientName : null, companyName: typeof input.companyName === "string" ? input.companyName : null, purpose: (typeof input.purpose === "string" && input.purpose.trim()) || "Introduction and next steps", tone: input.tone as never, templateKey: typeof input.templateKey === "string" ? input.templateKey : null });
      case "call_summary":
        return summarizeCall({ notes: typeof input.notes === "string" ? input.notes : "" }, Date.now());
      case "proposal_drafting": {
        const opp = await this.loadOpportunity(client, tenantId, entityId);
        return draftProposal({ opportunityName: opp.name, templateKey: typeof input.templateKey === "string" ? input.templateKey : null, scope: typeof input.scope === "string" ? input.scope : null, value: opp.amount });
      }
      case "opportunity_risk": {
        const opp = await this.loadOpportunity(client, tenantId, entityId);
        const days = Math.floor((Date.now() - opp.updated_at.getTime()) / 86_400_000);
        return assessOpportunityRisk({ daysSinceActivity: days, closeDateSlipped: Boolean(input.closeDateSlipped), hasDecisionMaker: input.hasDecisionMaker !== false, competitorPresent: Boolean(input.competitorPresent), priceObjection: opp.discount_status === "pending_approval" || Boolean(input.priceObjection), demoCompleted: input.demoCompleted !== false, engagementScore: typeof input.engagementScore === "number" ? (input.engagementScore as number) : opp.probability ?? 50 });
      }
      case "forecasting": {
        const opp = await this.loadOpportunity(client, tenantId, entityId);
        const stageWeight = opp.probability ?? (opp.stage_key === "negotiation" ? 70 : opp.stage_key === "proposal" ? 45 : opp.stage_key === "qualification" ? 25 : 10);
        return forecastOpportunity({ stageWeight, engagement: typeof input.engagement === "number" ? (input.engagement as number) : null, riskLevel: (input.riskLevel as never) ?? null, amount: opp.amount ?? 0, repProbability: opp.probability });
      }
      case "support_triage": {
        const ticket = await this.loadTicket(client, tenantId, entityId);
        const classification = suggestTicketClassification(ticket.subject, ticket.description);
        const text = `${ticket.subject} ${ticket.description ?? ""}`.toLowerCase();
        const sentiment = /angry|frustrat|unacceptable|terrible|urgent/.test(text) ? "negative" : "neutral";
        const priority = classification.urgency === "urgent" ? "urgent" : classification.urgency === "high" ? "high" : classification.urgency === "low" ? "low" : "medium";
        const confidence = classification.categoryKey ? 74 : 55;
        return { output: { category: classification.categoryKey, urgency: classification.urgency, priority, sentiment, suggestedOwnerId: ticket.owner_id }, confidence, lowConfidence: flagLowConfidence(confidence), reviewRequired: false, factors: [{ label: `Category: ${classification.categoryKey ?? "unknown"}`, impact: "neutral" }], sources: [{ label: "Ticket text", reference: "ticket" }] };
      }
      case "customer_health": {
        const cs = await this.loadCsAccount(client, tenantId, entityId);
        const stored = (cs.factors ?? {}) as Record<string, number>;
        const health = computeHealthScore(Object.keys(stored).length > 0 ? stored : { usage: cs.adoption_score ?? 50, csat: 60, engagement: 55, supportTickets: 60, slaBreaches: 70, loginActivity: 50, nps: 50, trainingCompletion: cs.training_status === "completed" ? 90 : 40, renewalProximity: 50, paymentStatus: 80 });
        const explanation = resolveAiExplanation(health.drivers.map((d) => ({ label: d.label, weight: d.impact === "positive" ? d.subScore : -(100 - d.subScore) })), health.score);
        const playbook = health.band === "red" ? "Executive save-play + renewal risk review" : health.band === "amber" ? "Adoption acceleration + check-in cadence" : "Advocacy and expansion motion";
        const confidence = 68;
        return { output: { score: health.score, band: health.band, drivers: health.drivers, recommendedPlaybook: playbook, lowConfidence: explanation.lowConfidence }, confidence, lowConfidence: flagLowConfidence(confidence), reviewRequired: false, factors: health.drivers.map((d) => ({ label: d.label, impact: d.impact })), sources: [{ label: "Health factors", reference: "customer_success_account" }] };
      }
      case "knowledge_assistant": {
        const query = typeof input.query === "string" ? input.query : "";
        const articles = await client.query<{ id: string; title: string; body: string | null }>(`SELECT id, title, body FROM knowledge_articles WHERE tenant_id = $1 AND status IN ('published', 'approved') LIMIT 200`, [tenantId]);
        const ranked = rankKnowledgeArticles(query, articles.rows.map((a) => ({ id: a.id, title: a.title, body: a.body })));
        const byId = new Map(articles.rows.map((a) => [a.id, a]));
        const top = ranked.slice(0, 3);
        const confidence = top.length === 0 ? 20 : Math.min(90, 40 + (top[0]?.score ?? 0) * 10);
        const answer = top.length > 0 ? `Based on approved knowledge: ${byId.get(top[0].id)?.title ?? ""}.` : "No approved knowledge matched this question.";
        return { output: { answer, matched: top.length }, confidence, lowConfidence: flagLowConfidence(confidence), reviewRequired: true, factors: [{ label: `${top.length} approved source(s)`, impact: top.length > 0 ? "positive" : "negative" }], sources: top.map((t) => ({ label: byId.get(t.id)?.title ?? "Article", reference: t.id })) };
      }
      default:
        throw new AppError(400, "Unknown agent.", undefined, "VALIDATION_ERROR");
    }
  }

  private async loadLead(client: PoolClient, tenantId: string, entityId: string | null) {
    if (!entityId) throw new AppError(400, "A lead id is required.", undefined, "VALIDATION_ERROR");
    const row = (await client.query<{ company_name: string; first_name: string; last_name: string; email: string | null; score: number | null; metadata: Record<string, unknown> | null }>(`SELECT company_name, first_name, last_name, email, score, metadata FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [entityId, tenantId])).rows[0];
    if (!row) throw new AppError(404, "Lead not found.", undefined, "NOT_FOUND");
    return row;
  }
  private async loadOpportunity(client: PoolClient, tenantId: string, entityId: string | null) {
    if (!entityId) throw new AppError(400, "An opportunity id is required.", undefined, "VALIDATION_ERROR");
    const row = (await client.query<{ name: string; amount: number | null; probability: number | null; updated_at: Date; stage_key: string | null; discount_status: string | null }>(
      `SELECT o.name, o.amount, o.probability, o.updated_at, st.value_key AS stage_key, o.metadata->'salesExec'->'discount'->>'status' AS discount_status
       FROM opportunities o LEFT JOIN tenant_option_values st ON st.id = o.stage_option_id AND st.tenant_id = o.tenant_id
       WHERE o.id = $1 AND o.tenant_id = $2 AND o.deleted_at IS NULL LIMIT 1`, [entityId, tenantId])).rows[0];
    if (!row) throw new AppError(404, "Opportunity not found.", undefined, "NOT_FOUND");
    return row;
  }
  private async loadTicket(client: PoolClient, tenantId: string, entityId: string | null) {
    if (!entityId) throw new AppError(400, "A ticket id is required.", undefined, "VALIDATION_ERROR");
    const row = (await client.query<{ subject: string; description: string | null; owner_id: string | null }>(`SELECT subject, description, owner_id FROM support_tickets WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [entityId, tenantId])).rows[0];
    if (!row) throw new AppError(404, "Ticket not found.", undefined, "NOT_FOUND");
    return row;
  }
  private async loadCsAccount(client: PoolClient, tenantId: string, entityId: string | null) {
    if (!entityId) throw new AppError(400, "A customer success account id is required.", undefined, "VALIDATION_ERROR");
    const row = (await client.query<{ adoption_score: number | null; training_status: string; factors: Record<string, number> | null }>(
      `SELECT csa.adoption_score, csa.training_status, (SELECT metadata->'factors' FROM customer_health_scores h WHERE h.cs_account_id = csa.id AND h.tenant_id = csa.tenant_id ORDER BY recorded_at DESC LIMIT 1) AS factors
       FROM customer_success_accounts csa WHERE csa.id = $1 AND csa.tenant_id = $2 AND csa.deleted_at IS NULL LIMIT 1`, [entityId, tenantId])).rows[0];
    if (!row) throw new AppError(404, "Customer success account not found.", undefined, "NOT_FOUND");
    return row;
  }

  async runAgent(actor: ActorContext, audit: AuditMetadata, agentKind: string, input: RunAgentRequestBody): Promise<AiAgentRunResponse> {
    this.assertEnabled();
    const kind = normalize(aiAgentKinds, agentKind, "lead_enrichment");
    if (kind !== agentKind) {
      throw new AppError(400, "Unknown agent kind.", undefined, "VALIDATION_ERROR");
    }
    const entityType = input.entityType ?? AGENT_ENTITY[kind] ?? null;
    const entityId = input.entityId ?? null;
    return this.databaseService.withTransaction(async (client) => {
      const envelope = await this.runResolver(client, actor.tenantId, kind, entityId, input.input ?? {});
      const reviewRequired = envelope.reviewRequired || humanReviewAgents.includes(kind);
      const inserted = await client.query<{ id: string; created_at: Date; status: string }>(
        `INSERT INTO ai_agent_runs (tenant_id, agent_kind, entity_type, entity_id, input, output, sources, confidence, low_confidence, review_required, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $11) RETURNING id, created_at, status`,
        [actor.tenantId, kind, entityType, entityId, JSON.stringify(input.input ?? {}), JSON.stringify(envelope.output), JSON.stringify(envelope.sources), envelope.confidence, envelope.lowConfidence, reviewRequired, actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "ai.agent.run", resourceType: "ai_agent_run", resourceId: inserted.rows[0].id, status: "success", metadata: { agentKind: kind, confidence: envelope.confidence, lowConfidence: envelope.lowConfidence } });
      const run: AiAgentRunSummary = { id: inserted.rows[0].id, agentKind: kind, entityType, entityId, output: envelope.output as Record<string, unknown>, sources: envelope.sources, confidence: envelope.confidence, lowConfidence: envelope.lowConfidence, reviewRequired, status: "suggested", createdAt: inserted.rows[0].created_at.toISOString() };
      return { run, factors: envelope.factors };
    });
  }

  async decideRun(actor: ActorContext, audit: AuditMetadata, runId: string, input: DecideAgentRunRequestBody) {
    this.assertEnabled();
    const status = input.decision === "accept" ? "accepted" : input.decision === "override" ? "overridden" : "rejected";
    return this.databaseService.withTransaction(async (client) => {
      const run = (await client.query<{ id: string; agent_kind: string; entity_type: string | null; entity_id: string | null; low_confidence: boolean; output: Record<string, unknown> }>(`SELECT id, agent_kind, entity_type, entity_id, low_confidence, output FROM ai_agent_runs WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [runId, actor.tenantId])).rows[0];
      if (!run) {
        throw new AppError(404, "Agent run not found.", undefined, "NOT_FOUND");
      }
      await client.query(`UPDATE ai_agent_runs SET status = $3, corrected = $4::jsonb, feedback = $5::jsonb, updated_by = $6 WHERE id = $1 AND tenant_id = $2`, [runId, actor.tenantId, status, input.corrected ? JSON.stringify(input.corrected) : null, JSON.stringify({ comment: input.feedbackComment ?? null, decidedBy: actor.userId }), actor.userId]);

      // AI-002 / AI-008: store the human decision as feedback so future scoring/triage improves.
      await client.query(
        `INSERT INTO ai_feedback (tenant_id, run_id, entity_type, entity_id, rating, is_hallucination, confidence_flag, comment, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8::jsonb, $9)`,
        [actor.tenantId, runId, run.entity_type, run.entity_id, input.decision === "accept" ? "helpful" : input.decision === "reject" ? "not_helpful" : "neutral", run.low_confidence ? "low" : "normal", input.feedbackComment ?? null, JSON.stringify({ agentKind: run.agent_kind, decision: input.decision }), actor.userId]
      );

      // AI-003 / AI-004: when accepted, log the interaction to the record's activity timeline.
      if (input.decision === "accept" && input.logActivity && run.entity_type && run.entity_id && (run.agent_kind === "email_drafting" || run.agent_kind === "call_summary")) {
        const activityType = run.agent_kind === "email_drafting" ? "email" : "call";
        const subject = run.agent_kind === "email_drafting" ? String((run.output as Record<string, unknown>).subject ?? "AI email") : "AI call summary";
        await client.query(
          `INSERT INTO crm_activities (tenant_id, entity_type, entity_id, activity_type, subject, description, occurred_at, author_user_id, owner_user_id, metadata, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $7, $8::jsonb, $7, $7)`,
          [actor.tenantId, run.entity_type, run.entity_id, activityType, subject, JSON.stringify(run.output).slice(0, 4000), actor.userId, JSON.stringify({ aiAgentRunId: runId })]
        ).catch(() => undefined);
      }
      await this.recordAuditLog(client, actor, audit, { action: "ai.agent.decide", resourceType: "ai_agent_run", resourceId: runId, status: "success", metadata: { decision: input.decision } });
      return { runId, status };
    });
  }

  async listRuns(actor: ActorContext, entityType: string | null, entityId: string | null, agentKind: string | null): Promise<AiAgentRunsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const conds = ["tenant_id = $1"];
      const params: unknown[] = [actor.tenantId];
      if (entityType && entityId) { params.push(entityType, entityId); conds.push(`entity_type = $${params.length - 1}`, `entity_id = $${params.length}`); }
      if (agentKind) { params.push(agentKind); conds.push(`agent_kind = $${params.length}`); }
      const result = await client.query(`SELECT id, agent_kind, entity_type, entity_id, output, sources, confidence, low_confidence, review_required, status, created_at FROM ai_agent_runs WHERE ${conds.join(" AND ")} ORDER BY created_at DESC LIMIT 50`, params);
      return {
        runs: result.rows.map((row) => ({ id: row.id, agentKind: normalize(aiAgentKinds, row.agent_kind, "lead_enrichment"), entityType: row.entity_type, entityId: row.entity_id, output: (row.output ?? {}) as Record<string, unknown>, sources: Array.isArray(row.sources) ? row.sources : [], confidence: row.confidence, lowConfidence: row.low_confidence, reviewRequired: row.review_required, status: normalize(aiAgentRunStatuses, row.status, "suggested"), createdAt: row.created_at.toISOString() }))
      };
    });
  }
}
