// AI-specific CRM user stories (AI-001..010): a governed AI-agent layer. Each agent produces a
// deterministic result (stand-in for the LLM, executed later via the governed AI Gateway) carrying
// confidence, an explanation, sources, a low-confidence flag, and a human-review gate. Reuses
// existing resolvers where they already exist (ticket classification, health, forecast, KB ranking).
// Deterministic helpers are unit-tested.

import { LOW_CONFIDENCE_THRESHOLD } from "./ai-governance.js";

export const aiAgentKinds = [
  "lead_enrichment",
  "lead_scoring",
  "email_drafting",
  "call_summary",
  "proposal_drafting",
  "opportunity_risk",
  "forecasting",
  "support_triage",
  "customer_health",
  "knowledge_assistant"
] as const;
export type AiAgentKind = (typeof aiAgentKinds)[number];

export const aiAgentRunStatuses = ["suggested", "accepted", "overridden", "rejected"] as const;
export type AiAgentRunStatus = (typeof aiAgentRunStatuses)[number];

// Agents that always require human review before the output can be used externally / to act.
export const humanReviewAgents: readonly AiAgentKind[] = ["email_drafting", "proposal_drafting", "knowledge_assistant"];

export interface AgentSource {
  label: string;
  reference: string;
}

export interface AgentFactor {
  label: string;
  impact: "positive" | "negative" | "neutral";
}

/** Governed envelope every agent returns. */
export interface AgentEnvelope<T> {
  output: T;
  confidence: number;
  lowConfidence: boolean;
  reviewRequired: boolean;
  factors: AgentFactor[];
  sources: AgentSource[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function slug(value: string): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function flagLowConfidence(confidence: number): boolean {
  return confidence < LOW_CONFIDENCE_THRESHOLD;
}

// ---- AI-001: lead enrichment -------------------------------------------------------------------

export interface LeadEnrichmentInput {
  companyName: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  industryHint?: string | null;
}

export interface LeadEnrichmentOutput {
  companyDetails: string;
  industry: string;
  size: string;
  website: string;
  role: string;
  painPoints: string[];
  talkingPoints: string[];
}

/** AI-001: deterministic enrichment suggestion (stands in for the AI enrichment agent). */
export function enrichLead(input: LeadEnrichmentInput): AgentEnvelope<LeadEnrichmentOutput> {
  const domain = input.email && input.email.includes("@") ? input.email.split("@")[1] : `${slug(input.companyName) || "example"}.com`;
  const industry = (input.industryHint ?? "").trim() || "Technology";
  const output: LeadEnrichmentOutput = {
    companyDetails: `${input.companyName} operates in ${industry}.`,
    industry,
    size: "51-200",
    website: `https://${domain}`,
    role: input.firstName ? "Decision maker" : "Contact",
    painPoints: ["Manual processes slowing growth", "Fragmented tooling", "Limited reporting visibility"],
    talkingPoints: [`How ${input.companyName} can consolidate tooling`, "Time-to-value and quick wins", "ROI and reporting"]
  };
  const confidence = input.email ? 55 : 42;
  return { output, confidence, lowConfidence: flagLowConfidence(confidence), reviewRequired: true, factors: [{ label: "Email domain available", impact: input.email ? "positive" : "negative" }], sources: [{ label: "Heuristic enrichment", reference: "deterministic" }] };
}

// ---- AI-002: lead scoring ----------------------------------------------------------------------

export interface LeadScoringSignals {
  icpFit?: number | null; // 0–100
  engagement?: number | null; // 0–100
  seniority?: number | null; // 0–100
  budgetSignal?: number | null; // 0–100
  recency?: number | null; // 0–100 (recent activity)
  negativeSignals?: number | null; // count (disqualifiers)
}

export const leadScoreWeights = { icpFit: 0.3, engagement: 0.25, seniority: 0.15, budgetSignal: 0.15, recency: 0.15 } as const;

export interface LeadScoringOutput {
  score: number;
  band: "hot" | "warm" | "cold";
  drivers: AgentFactor[];
}

/** AI-002: weighted lead score over structured signals with an explanation. */
export function scoreLead(signals: LeadScoringSignals): AgentEnvelope<LeadScoringOutput> {
  const keys = Object.keys(leadScoreWeights) as (keyof typeof leadScoreWeights)[];
  const provided = keys.filter((key) => typeof signals[key] === "number");
  let base = 0;
  if (provided.length > 0) {
    const totalWeight = provided.reduce((sum, key) => sum + leadScoreWeights[key], 0);
    base = provided.reduce((sum, key) => sum + clamp(signals[key] as number, 0, 100) * leadScoreWeights[key], 0) / totalWeight;
  }
  const penalty = Math.min(30, Math.max(0, signals.negativeSignals ?? 0) * 10);
  const score = Math.round(clamp(base - penalty, 0, 100));
  const band: LeadScoringOutput["band"] = score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";
  const drivers: AgentFactor[] = provided
    .map((key) => ({ label: key, value: clamp(signals[key] as number, 0, 100) }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 3)
    .map((d) => ({ label: d.label, impact: (d.value >= score ? "positive" : "negative") as "positive" | "negative" }));
  return { output: { score, band, drivers }, confidence: provided.length >= 3 ? 78 : 55, lowConfidence: flagLowConfidence(provided.length >= 3 ? 78 : 55), reviewRequired: false, factors: drivers, sources: [{ label: "Structured CRM signals", reference: "lead" }] };
}

// ---- AI-003: email drafting --------------------------------------------------------------------

export const emailTones = ["formal", "friendly", "concise", "consultative"] as const;
export type EmailTone = (typeof emailTones)[number];

export interface EmailDraftInput {
  recipientName?: string | null;
  companyName?: string | null;
  purpose: string;
  tone?: EmailTone;
  templateKey?: string | null;
}

export interface EmailDraftOutput {
  subject: string;
  body: string;
}

/** AI-003: draft an email from CRM context; review is required before sending. */
export function draftEmail(input: EmailDraftInput): AgentEnvelope<EmailDraftOutput> {
  const who = (input.recipientName ?? "there").trim() || "there";
  const tone = input.tone ?? "consultative";
  const greeting = tone === "formal" ? `Dear ${who},` : `Hi ${who},`;
  const closing = tone === "formal" ? "Kind regards," : "Best,";
  const subject = `${input.purpose}${input.companyName ? ` — ${input.companyName}` : ""}`;
  const body = `${greeting}\n\n${input.purpose}. I'd love to find 20 minutes to explore how we can help${input.companyName ? ` ${input.companyName}` : ""}.\n\nWould this week work?\n\n${closing}`;
  return { output: { subject, body }, confidence: 70, lowConfidence: false, reviewRequired: true, factors: [{ label: `Tone: ${tone}`, impact: "neutral" }], sources: [{ label: input.templateKey ? `Template ${input.templateKey}` : "Default template", reference: input.templateKey ?? "default" }] };
}

// ---- AI-004: call summary ----------------------------------------------------------------------

export interface CallSummaryInput {
  notes: string;
}

export interface CallSummaryOutput {
  painPoints: string;
  questions: string;
  objections: string;
  nextSteps: string;
  sentiment: "positive" | "neutral" | "negative";
  followUpDate: string | null;
}

/** AI-004: structure raw call notes into a summary; editable, links to the timeline on save. */
export function summarizeCall(input: CallSummaryInput, nowMs: number): AgentEnvelope<CallSummaryOutput> {
  const text = (input.notes ?? "").toLowerCase();
  const sentiment: CallSummaryOutput["sentiment"] = /great|excited|love|positive|keen/.test(text) ? "positive" : /concern|worried|expensive|blocker|frustrat/.test(text) ? "negative" : "neutral";
  const followUp = new Date(nowMs + 3 * 86_400_000).toISOString().slice(0, 10);
  const output: CallSummaryOutput = {
    painPoints: input.notes ? input.notes.slice(0, 240) : "",
    questions: /\?/.test(input.notes) ? "Customer raised clarifying questions." : "No open questions captured.",
    objections: /expensive|price|budget|cost/.test(text) ? "Pricing / budget concern raised." : "None captured.",
    nextSteps: "Send recap and proposed next meeting.",
    sentiment,
    followUpDate: followUp
  };
  return { output, confidence: 62, lowConfidence: false, reviewRequired: false, factors: [{ label: `Sentiment: ${sentiment}`, impact: sentiment === "negative" ? "negative" : "positive" }], sources: [{ label: "Call notes", reference: "transcript" }] };
}

// ---- AI-005: proposal drafting -----------------------------------------------------------------

export interface ProposalDraftInput {
  opportunityName: string;
  templateKey?: string | null;
  scope?: string | null;
  value?: number | null;
}

export interface ProposalDraftOutput {
  sections: Array<{ heading: string; content: string }>;
  assumptions: string[];
  missingInformation: string[];
}

/** AI-005: draft a proposal from approved templates; marks assumptions + gaps; needs human approval. */
export function draftProposal(input: ProposalDraftInput): AgentEnvelope<ProposalDraftOutput> {
  const sections = [
    { heading: "Executive summary", content: `Proposal for ${input.opportunityName}.` },
    { heading: "Scope", content: (input.scope ?? "").trim() || "[Scope to be confirmed]" },
    { heading: "Commercials", content: typeof input.value === "number" ? `Estimated value: ${input.value}.` : "[Pricing pending]" }
  ];
  const missingInformation: string[] = [];
  if (!input.scope) missingInformation.push("Implementation scope");
  if (typeof input.value !== "number") missingInformation.push("Commercial value");
  const assumptions = ["Standard terms apply unless amended", "Delivery timeline assumes timely customer inputs"];
  const confidence = missingInformation.length === 0 ? 68 : 48;
  return { output: { sections, assumptions, missingInformation }, confidence, lowConfidence: flagLowConfidence(confidence), reviewRequired: true, factors: missingInformation.map((m) => ({ label: `Missing: ${m}`, impact: "negative" as const })), sources: [{ label: input.templateKey ? `Template ${input.templateKey}` : "Content library", reference: input.templateKey ?? "content_library" }] };
}

// ---- AI-006: opportunity risk ------------------------------------------------------------------

export const opportunityRiskFactors = ["inactivity", "close_date_slippage", "missing_decision_maker", "competitor", "price_objection", "demo_gap", "low_engagement"] as const;
export type OpportunityRiskFactor = (typeof opportunityRiskFactors)[number];

export interface OpportunityRiskSignals {
  daysSinceActivity: number;
  closeDateSlipped?: boolean;
  hasDecisionMaker?: boolean;
  competitorPresent?: boolean;
  priceObjection?: boolean;
  demoCompleted?: boolean;
  engagementScore?: number | null; // 0–100
}

export interface OpportunityRiskOutput {
  riskLevel: "low" | "medium" | "high";
  factors: OpportunityRiskFactor[];
  recommendedAction: string;
}

/** AI-006: detect opportunity risk factors and a recommended save action. */
export function assessOpportunityRisk(signals: OpportunityRiskSignals): AgentEnvelope<OpportunityRiskOutput> {
  const factors: OpportunityRiskFactor[] = [];
  if (signals.daysSinceActivity >= 14) factors.push("inactivity");
  if (signals.closeDateSlipped) factors.push("close_date_slippage");
  if (signals.hasDecisionMaker === false) factors.push("missing_decision_maker");
  if (signals.competitorPresent) factors.push("competitor");
  if (signals.priceObjection) factors.push("price_objection");
  if (signals.demoCompleted === false) factors.push("demo_gap");
  if (typeof signals.engagementScore === "number" && signals.engagementScore < 40) factors.push("low_engagement");
  const riskLevel: OpportunityRiskOutput["riskLevel"] = factors.length >= 3 ? "high" : factors.length >= 1 ? "medium" : "low";
  const recommendedAction = factors.includes("missing_decision_maker")
    ? "Secure a meeting with the economic buyer."
    : factors.includes("competitor")
      ? "Run a competitive differentiation session."
      : factors.includes("price_objection")
        ? "Reframe value and validate budget with a manager review."
        : factors.length > 0
          ? "Re-engage with a tailored next step to rebuild momentum."
          : "Maintain cadence toward close.";
  const confidence = 72;
  return { output: { riskLevel, factors, recommendedAction }, confidence, lowConfidence: flagLowConfidence(confidence), reviewRequired: false, factors: factors.map((f) => ({ label: f.replace(/_/g, " "), impact: "negative" as const })), sources: [{ label: "Opportunity signals", reference: "opportunity" }] };
}

// ---- AI-007: forecasting -----------------------------------------------------------------------

export interface ForecastSignals {
  stageWeight: number; // 0–100 stage-implied probability
  engagement?: number | null; // 0–100
  riskLevel?: "low" | "medium" | "high" | null;
  amount: number;
  repProbability?: number | null; // rep's own forecast %
}

export interface ForecastOutput {
  closeProbability: number;
  expectedRevenue: number;
  repProbability: number | null;
  variance: number | null;
  factors: AgentFactor[];
}

/** AI-007: predict close probability + expected revenue and compare with the rep forecast. */
export function forecastOpportunity(signals: ForecastSignals): AgentEnvelope<ForecastOutput> {
  let prob = signals.stageWeight;
  if (typeof signals.engagement === "number") prob = prob * 0.7 + signals.engagement * 0.3;
  if (signals.riskLevel === "high") prob -= 25;
  else if (signals.riskLevel === "medium") prob -= 10;
  const closeProbability = Math.round(clamp(prob, 0, 100));
  const expectedRevenue = Math.round(signals.amount * (closeProbability / 100));
  const repProbability = typeof signals.repProbability === "number" ? Math.round(signals.repProbability) : null;
  const variance = repProbability !== null ? closeProbability - repProbability : null;
  const confidence = 70;
  return {
    output: { closeProbability, expectedRevenue, repProbability, variance, factors: [{ label: "Stage weight", impact: "neutral" }, { label: signals.riskLevel === "high" ? "High risk drag" : "Risk", impact: signals.riskLevel === "high" ? "negative" : "neutral" }] },
    confidence,
    lowConfidence: flagLowConfidence(confidence),
    reviewRequired: false,
    factors: [{ label: `AI ${closeProbability}% vs rep ${repProbability ?? "—"}%`, impact: variance !== null && variance < -15 ? "negative" : "neutral" }],
    sources: [{ label: "Pipeline signals", reference: "opportunity" }]
  };
}

// ---- API contract ------------------------------------------------------------------------------

export interface AiAgentRunSummary {
  id: string;
  agentKind: AiAgentKind;
  entityType: string | null;
  entityId: string | null;
  output: Record<string, unknown>;
  sources: AgentSource[];
  confidence: number | null;
  lowConfidence: boolean;
  reviewRequired: boolean;
  status: AiAgentRunStatus;
  createdAt: string;
}

export interface AiAgentRunResponse {
  run: AiAgentRunSummary;
  factors: AgentFactor[];
}

export interface AiAgentRunsResponse {
  runs: AiAgentRunSummary[];
}

// ---- Request bodies ----------------------------------------------------------------------------

export interface RunAgentRequestBody {
  entityType?: string | null;
  entityId?: string | null;
  input?: Record<string, unknown>;
}

export interface DecideAgentRunRequestBody {
  decision: "accept" | "override" | "reject";
  corrected?: Record<string, unknown>;
  feedbackComment?: string | null;
  logActivity?: boolean;
}
