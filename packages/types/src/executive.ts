// Persona 32 (Executive / CEO / CXO) pure resolvers + API contract.
// Executive command center (EXE-001), AI business insights (EXE-002), and strategic risk register
// (EXE-003). Deterministic helpers are unit-tested; the AI executive summary + insight narration
// stay governed placeholders over the deterministic signals.

// ---- KPI resolvers -----------------------------------------------------------------------------

/** EXE-001: win rate = won / (won + lost), 0 when there are no closed deals. */
export function computeExecWinRate(won: number, lost: number): number {
  const closed = won + lost;
  return closed > 0 ? Math.round((won / closed) * 100) : 0;
}

export interface ForecastBucket {
  amount: number;
  probability: number; // 0–100
}

/** EXE-001: probability-weighted forecast over open pipeline. */
export function computeWeightedForecast(buckets: ForecastBucket[]): number {
  return Math.round(buckets.reduce((sum, bucket) => sum + bucket.amount * (Math.max(0, Math.min(100, bucket.probability)) / 100), 0));
}

/** EXE-001: return-on-investment percentage for campaign spend. */
export function computeRoi(revenue: number, spend: number): number | null {
  if (spend <= 0) {
    return null;
  }
  return Math.round(((revenue - spend) / spend) * 100);
}

// ---- EXE-002: AI business insights -------------------------------------------------------------

export const executiveInsightKeys = [
  "pipeline_gap",
  "forecast_risk",
  "churn_risk",
  "sales_underperformance",
  "campaign_inefficiency",
  "partner_inactivity"
] as const;
export type ExecutiveInsightKey = (typeof executiveInsightKeys)[number];

export const insightSeverities = ["info", "warning", "critical"] as const;
export type InsightSeverity = (typeof insightSeverities)[number];

export interface ExecutiveInsight {
  key: ExecutiveInsightKey;
  severity: InsightSeverity;
  message: string;
  recommendedAction: string;
  suggestedOwnerRole: string;
}

export interface ExecutiveInsightInput {
  pipelineCoverage: number; // pipeline / target (e.g., 2.5 = 2.5x)
  forecastAttainment: number; // forecast / target (0–1+)
  atRiskCustomers: number;
  totalCustomers: number;
  quotaAttainment: number; // 0–1+
  campaignRoi: number | null; // percent
  inactivePartners: number;
}

/**
 * EXE-002: deterministic detection of the six executive insight categories, each with a
 * recommended action and a suggested owning leader (stands in for the AI narration).
 */
export function detectExecutiveInsights(input: ExecutiveInsightInput): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = [];
  if (input.pipelineCoverage < 3) {
    insights.push({ key: "pipeline_gap", severity: input.pipelineCoverage < 2 ? "critical" : "warning", message: `Pipeline coverage is ${input.pipelineCoverage.toFixed(1)}x, below the 3x guideline.`, recommendedAction: "Accelerate top-of-funnel generation and reallocate SDR capacity.", suggestedOwnerRole: "Sales Head" });
  }
  if (input.forecastAttainment < 0.9) {
    insights.push({ key: "forecast_risk", severity: input.forecastAttainment < 0.75 ? "critical" : "warning", message: `Forecast attainment is ${Math.round(input.forecastAttainment * 100)}% of target.`, recommendedAction: "Run deal inspection on late-stage opportunities and de-risk slippage.", suggestedOwnerRole: "Sales Head" });
  }
  const churnRate = input.totalCustomers > 0 ? input.atRiskCustomers / input.totalCustomers : 0;
  if (churnRate > 0.1) {
    insights.push({ key: "churn_risk", severity: churnRate > 0.25 ? "critical" : "warning", message: `${input.atRiskCustomers} of ${input.totalCustomers} customers are at risk (${Math.round(churnRate * 100)}%).`, recommendedAction: "Trigger save-plays on red accounts and review renewals due this quarter.", suggestedOwnerRole: "CS Head" });
  }
  if (input.quotaAttainment < 0.85) {
    insights.push({ key: "sales_underperformance", severity: input.quotaAttainment < 0.6 ? "critical" : "warning", message: `Quota attainment is ${Math.round(input.quotaAttainment * 100)}%.`, recommendedAction: "Coach underperforming segments and rebalance territory coverage.", suggestedOwnerRole: "Sales Head" });
  }
  if (input.campaignRoi !== null && input.campaignRoi < 0) {
    insights.push({ key: "campaign_inefficiency", severity: input.campaignRoi < -50 ? "critical" : "warning", message: `Blended campaign ROI is ${input.campaignRoi}%.`, recommendedAction: "Pause underperforming campaigns and shift budget to converting channels.", suggestedOwnerRole: "Marketing Manager" });
  }
  if (input.inactivePartners > 0) {
    insights.push({ key: "partner_inactivity", severity: input.inactivePartners >= 5 ? "warning" : "info", message: `${input.inactivePartners} partner(s) have no recent deal activity.`, recommendedAction: "Re-engage dormant partners with enablement and co-sell plays.", suggestedOwnerRole: "Partner Manager" });
  }
  return insights;
}

// ---- EXE-003: strategic risk register ----------------------------------------------------------

export const riskSources = ["opportunity", "customer", "support", "renewal", "ai_alert", "manual"] as const;
export type RiskSource = (typeof riskSources)[number];

export const strategicRiskSeverities = ["low", "medium", "high", "critical"] as const;
export type StrategicRiskSeverity = (typeof strategicRiskSeverities)[number];

export const riskStatuses = ["open", "monitoring", "mitigated", "closed"] as const;
export type StrategicRiskStatus = (typeof riskStatuses)[number];

// ---- API contract ------------------------------------------------------------------------------

export interface ExecutiveKpi {
  key: string;
  label: string;
  value: number | null;
  unit: "currency" | "percent" | "count";
}

export interface CommandCenterFilters {
  from: string | null;
  to: string | null;
  region: string | null;
  product: string | null;
  team: string | null;
  segment: string | null;
}

export interface ExecutiveCommandCenterResponse {
  filters: CommandCenterFilters;
  kpis: ExecutiveKpi[];
  openStrategicRisks: number;
  aiSummary: { available: false; message: string };
}

export interface ExecutiveInsightsResponse {
  insights: ExecutiveInsight[];
  aiPlaceholder: { available: false; message: string };
}

export interface StrategicRiskSummary {
  id: string;
  title: string;
  source: RiskSource;
  ownerId: string | null;
  severity: StrategicRiskSeverity;
  impact: string | null;
  mitigation: string | null;
  dueDate: string | null;
  status: StrategicRiskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StrategicRisksResponse {
  risks: StrategicRiskSummary[];
  openCount: number;
}

// ---- Request bodies ----------------------------------------------------------------------------

export interface AssignInsightActionRequestBody {
  insightKey: string;
  title: string;
  description?: string | null;
  assignedTo: string;
}

export interface CreateStrategicRiskRequestBody {
  title: string;
  source?: RiskSource;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  ownerId: string;
  severity?: StrategicRiskSeverity;
  impact?: string | null;
  mitigation?: string | null;
  dueDate?: string | null;
}

export interface UpdateStrategicRiskRequestBody {
  ownerId?: string | null;
  severity?: StrategicRiskSeverity;
  impact?: string | null;
  mitigation?: string | null;
  dueDate?: string | null;
  status?: StrategicRiskStatus;
}
