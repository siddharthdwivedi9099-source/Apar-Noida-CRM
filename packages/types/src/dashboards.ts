// ============================================================================
// Phase 23: Dashboards and Analytics
// ============================================================================

export const dashboardWidgetTypes = ["metric", "chart", "funnel", "series", "table", "kanban"] as const;
export type DashboardWidgetType = (typeof dashboardWidgetTypes)[number];

export type DashboardWidgetDataKind = "scalar" | "breakdown" | "series" | "funnel" | "table";

export interface DashboardWidgetDefinition {
  key: string;
  label: string;
  type: DashboardWidgetType;
  metricKey: string;
  drilldown: boolean;
}

export interface DashboardDefinition {
  key: string;
  name: string;
  category: string;
  description: string;
  modules: string[];
  requiredPermissions: string[];
  widgets: DashboardWidgetDefinition[];
}

interface DashboardSeed {
  key: string;
  name: string;
  category: string;
  description: string;
  modules: string[];
  widgets: DashboardWidgetDefinition[];
}

// Widget builders keep widget definitions terse and consistent.
const W = (key: string, label: string, type: DashboardWidgetType, metricKey: string, drilldown = false): DashboardWidgetDefinition => ({ key, label, type, metricKey, drilldown });

const dashboardSeeds: DashboardSeed[] = [
  {
    key: "executive", name: "Executive dashboard", category: "executive", description: "Cross-functional executive overview.", modules: ["dashboards"],
    widgets: [W("pipeline_value", "Pipeline value", "metric", "pipeline_value"), W("forecast_value", "Forecast value", "metric", "forecast_value"), W("win_rate", "Win rate", "metric", "win_rate"), W("health", "Customer health", "chart", "health_score_distribution"), W("open_tickets", "Open tickets", "metric", "open_tickets"), W("risk_alerts", "Risk alerts", "chart", "risk_alerts")]
  },
  {
    key: "sales", name: "Sales dashboard", category: "sales", description: "Sales pipeline and performance.", modules: ["sales", "leads", "opportunities"],
    widgets: [W("leads_by_status", "Leads by status", "chart", "leads_by_status", true), W("opportunities_by_stage", "Opportunities by stage", "funnel", "opportunities_by_stage", true), W("pipeline_value", "Pipeline value", "metric", "pipeline_value"), W("win_rate", "Win rate", "metric", "win_rate"), W("forecast_value", "Forecast value", "metric", "forecast_value")]
  },
  {
    key: "marketing", name: "Marketing dashboard", category: "marketing", description: "Marketing programs and lead generation.", modules: ["marketing", "campaigns"],
    widgets: [W("campaign_count", "Campaigns", "metric", "campaign_count"), W("campaign_members", "Campaign members", "metric", "campaign_members"), W("lead_source", "Lead source", "chart", "lead_source", true), W("campaign_conversion", "Campaign conversion", "metric", "campaign_conversion")]
  },
  {
    key: "campaign", name: "Campaign dashboard", category: "marketing", description: "Campaign execution detail.", modules: ["campaigns"],
    widgets: [W("campaign_count", "Campaigns", "metric", "campaign_count"), W("campaign_members", "Campaign members", "metric", "campaign_members"), W("campaign_conversion", "Conversion", "metric", "campaign_conversion")]
  },
  {
    key: "social", name: "Social media dashboard", category: "marketing", description: "Social publishing overview.", modules: ["social"],
    widgets: [W("social_posts", "Posts by status", "chart", "social_posts_summary"), W("campaign_count", "Campaigns", "metric", "campaign_count")]
  },
  {
    key: "sdr", name: "SDR dashboard", category: "sales", description: "SDR prospecting and qualification.", modules: ["sales", "leads"],
    widgets: [W("leads_kanban", "Leads (kanban)", "kanban", "leads_by_status"), W("leads_by_status", "Leads by status", "chart", "leads_by_status", true), W("lead_source", "Lead source", "chart", "lead_source", true)]
  },
  {
    key: "inside_sales", name: "Inside sales dashboard", category: "sales", description: "Inside sales pipeline conversion.", modules: ["sales", "leads", "opportunities"],
    widgets: [W("leads_by_status", "Leads by status", "chart", "leads_by_status", true), W("opportunities_by_stage", "Opportunities by stage", "funnel", "opportunities_by_stage", true), W("pipeline_value", "Pipeline value", "metric", "pipeline_value")]
  },
  {
    key: "presales", name: "Presales dashboard", category: "presales", description: "Presales pipeline and deal risk.", modules: ["presales", "opportunities"],
    widgets: [W("opportunities_by_stage", "Opportunities by stage", "funnel", "opportunities_by_stage", true), W("deal_risk_summary", "Deal risk", "table", "deal_risk_summary", true)]
  },
  {
    key: "partner", name: "Partner dashboard", category: "partners", description: "Partner channel overview.", modules: ["partners"],
    widgets: [W("partner_summary", "Partners by status", "chart", "partner_summary"), W("pipeline_value", "Pipeline value", "metric", "pipeline_value")]
  },
  {
    key: "reseller", name: "Reseller dashboard", category: "resellers", description: "Reseller channel overview.", modules: ["resellers"],
    widgets: [W("reseller_summary", "Resellers by status", "chart", "reseller_summary"), W("pipeline_value", "Pipeline value", "metric", "pipeline_value")]
  },
  {
    key: "support", name: "Support dashboard", category: "support", description: "Support operations and SLAs.", modules: ["support"],
    widgets: [W("open_tickets", "Open tickets", "metric", "open_tickets", true), W("sla_breaches", "SLA breaches", "metric", "sla_breaches"), W("ticket_status", "Tickets (kanban)", "kanban", "ticket_status"), W("ticket_priority", "By priority", "chart", "ticket_priority"), W("ticket_category", "By category", "chart", "ticket_category"), W("csat", "CSAT", "metric", "csat")]
  },
  {
    key: "customer_success", name: "Customer success dashboard", category: "customer_success", description: "Customer success health and retention.", modules: ["customer_success"],
    widgets: [W("health", "Health distribution", "chart", "health_score_distribution"), W("at_risk", "At-risk customers", "metric", "at_risk_customers", true), W("adoption", "Adoption score", "metric", "adoption_score"), W("renewal_timeline", "Renewal timeline", "series", "renewal_timeline"), W("training_completion", "Training completion", "metric", "training_completion")]
  },
  {
    key: "onboarding", name: "Onboarding dashboard", category: "customer_success", description: "Onboarding progress.", modules: ["customer_success"],
    widgets: [W("onboarding_progress", "Onboarding progress", "chart", "onboarding_progress"), W("training_completion", "Training completion", "metric", "training_completion")]
  },
  {
    key: "customer_health", name: "Customer health dashboard", category: "customer_success", description: "Customer health and risk.", modules: ["customer_success"],
    widgets: [W("health", "Health distribution", "chart", "health_score_distribution"), W("at_risk", "At-risk customers", "metric", "at_risk_customers", true), W("adoption", "Adoption score", "metric", "adoption_score"), W("customer_risk_summary", "Customer risk", "table", "customer_risk_summary", true)]
  },
  {
    key: "training", name: "Training dashboard", category: "training", description: "Training adoption and completion.", modules: ["training"],
    widgets: [W("training_completion", "Training completion", "metric", "training_completion")]
  },
  {
    key: "revenue", name: "Revenue dashboard", category: "revenue", description: "Revenue and renewals.", modules: ["dashboards", "opportunities", "customer_success"],
    widgets: [W("pipeline_value", "Pipeline value", "metric", "pipeline_value"), W("forecast_value", "Forecast value", "metric", "forecast_value"), W("renewal_timeline", "Renewal timeline", "series", "renewal_timeline")]
  },
  {
    key: "forecast", name: "Forecast dashboard", category: "revenue", description: "Forecasting and deal risk.", modules: ["dashboards", "opportunities", "customer_success"],
    widgets: [W("forecast_value", "Forecast value", "metric", "forecast_value"), W("win_rate", "Win rate", "metric", "win_rate"), W("renewal_timeline", "Renewal timeline", "series", "renewal_timeline"), W("deal_risk_summary", "Deal risk", "table", "deal_risk_summary", true)]
  },
  {
    key: "ai_insights", name: "AI insights dashboard", category: "ai", description: "AI-derived risk and recommendations.", modules: ["ai"],
    widgets: [W("risk_alerts", "Risk alerts", "chart", "risk_alerts"), W("recommended_actions", "Recommended actions", "chart", "recommended_actions"), W("underperforming_areas", "Underperforming areas", "chart", "underperforming_areas"), W("customer_risk_summary", "Customer risk", "table", "customer_risk_summary", true), W("deal_risk_summary", "Deal risk", "table", "deal_risk_summary", true)]
  },
  // ---- Required dashboards (Section 11): one comprehensive dashboard per function; each panel is a required view. ----
  {
    key: "marketing_overview", name: "Marketing overview", category: "marketing", description: "Campaign performance, ROI, attribution, MQL funnel, and program performance.", modules: ["marketing", "campaigns"],
    widgets: [W("campaign_performance", "Campaign performance", "metric", "campaign_conversion"), W("channel_roi", "Channel ROI", "metric", "channel_roi"), W("lead_source_attribution", "Lead source attribution", "chart", "lead_source", true), W("mql_generation", "MQL generation", "metric", "mql_generation"), W("mql_to_sql", "MQL-to-SQL conversion", "metric", "mql_to_sql"), W("content_performance", "Content performance", "metric", "content_performance"), W("paid_campaign_roi", "Paid campaign ROI", "metric", "paid_campaign_roi"), W("webinar_performance", "Webinar performance", "metric", "webinar_performance"), W("nurture_performance", "Nurture performance", "metric", "nurture_performance")]
  },
  {
    key: "sales_overview", name: "Sales overview", category: "sales", description: "Queue, pipeline, aging, forecast, win/loss, rep performance, strategic + dormant deals.", modules: ["sales", "leads", "opportunities"],
    widgets: [W("lead_queue", "Lead queue", "chart", "leads_by_status", true), W("opportunity_pipeline", "Opportunity pipeline", "funnel", "opportunities_by_stage", true), W("stage_aging", "Stage aging", "chart", "stage_aging"), W("forecast", "Forecast", "metric", "forecast_value"), W("win_loss", "Win/loss", "metric", "win_rate"), W("rep_performance", "Rep performance", "table", "rep_performance"), W("activity_tracking", "Activity tracking", "metric", "activity_tracking"), W("strategic_deals", "Strategic deals", "table", "deal_risk_summary", true), W("discount_approvals", "Discount approvals", "metric", "discount_approvals"), W("dormant_opportunities", "Dormant opportunities", "metric", "dormant_opportunities")]
  },
  {
    key: "presales_overview", name: "Presales overview", category: "presales", description: "Demo requests/outcomes, POC status, solution gaps, RFP workload, technical risk.", modules: ["presales", "opportunities"],
    widgets: [W("demo_requests", "Demo requests", "metric", "demo_requests"), W("demo_outcomes", "Demo outcomes", "metric", "demo_outcomes"), W("poc_status", "POC status", "metric", "poc_status"), W("solution_gaps", "Solution gaps", "metric", "solution_gaps"), W("rfp_workload", "RFP workload", "metric", "rfp_workload"), W("technical_risk", "Technical risk", "table", "deal_risk_summary", true)]
  },
  {
    key: "partner_overview", name: "Partner overview", category: "partners", description: "Partner pipeline, registrations, onboarding, performance, commissions, conflicts.", modules: ["partners"],
    widgets: [W("partner_pipeline", "Partner pipeline", "metric", "partner_pipeline"), W("deal_registration", "Deal registration", "metric", "deal_registrations"), W("partner_onboarding", "Partner onboarding", "metric", "partner_onboarding"), W("partner_performance", "Partner performance", "chart", "partner_summary"), W("commission_status", "Commission status", "metric", "commission_status"), W("conflict_cases", "Conflict cases", "metric", "conflict_cases")]
  },
  {
    key: "support_overview", name: "Support overview", category: "support", description: "Backlog, SLA, escalations, CSAT, reopen rate, RCA pending, recurring issues, agents.", modules: ["support"],
    widgets: [W("ticket_backlog", "Ticket backlog", "metric", "open_tickets", true), W("sla_compliance", "SLA compliance", "metric", "sla_breaches"), W("escalations", "Escalations", "metric", "escalations"), W("csat", "CSAT", "metric", "csat"), W("reopen_rate", "Reopen rate", "metric", "reopen_rate"), W("rca_pending", "RCA pending", "metric", "rca_pending"), W("recurring_issues", "Recurring issues", "chart", "ticket_category"), W("agent_performance", "Agent performance", "table", "agent_performance")]
  },
  {
    key: "customer_success_overview", name: "Customer success overview", category: "customer_success", description: "Health, onboarding, adoption, renewals, churn, expansion, QBR, advocacy.", modules: ["customer_success"],
    widgets: [W("customer_health", "Customer health", "chart", "health_score_distribution"), W("onboarding_progress", "Onboarding progress", "chart", "onboarding_progress"), W("adoption", "Adoption", "metric", "adoption_score"), W("renewal_pipeline", "Renewal pipeline", "series", "renewal_timeline"), W("churn_risk", "Churn risk", "metric", "at_risk_customers", true), W("expansion_signals", "Expansion signals", "metric", "expansion_signals"), W("qbr_status", "QBR status", "metric", "qbr_status"), W("advocacy_readiness", "Advocacy readiness", "metric", "advocacy_readiness")]
  },
  {
    key: "executive_overview", name: "Executive overview", category: "executive", description: "Revenue, forecast risk, coverage, marketing ROI, productivity, health, support, partner, AI.", modules: ["dashboards"],
    widgets: [W("revenue_performance", "Revenue performance", "metric", "pipeline_value"), W("forecast_risk", "Forecast risk", "metric", "forecast_value"), W("pipeline_coverage", "Pipeline coverage", "metric", "pipeline_coverage"), W("marketing_roi", "Marketing ROI", "metric", "channel_roi"), W("sales_productivity", "Sales productivity", "table", "rep_performance"), W("customer_health", "Customer health", "chart", "health_score_distribution"), W("support_performance", "Support performance", "metric", "sla_breaches"), W("partner_contribution", "Partner contribution", "metric", "partner_pipeline"), W("ai_impact", "AI impact", "metric", "ai_usage")]
  },
  {
    key: "admin_governance", name: "Admin & governance overview", category: "admin", description: "Adoption, data quality, automation, approvals, AI usage/override, audit, integrations, SLA.", modules: ["admin"],
    widgets: [W("user_adoption", "User adoption", "metric", "user_adoption"), W("data_quality", "Data quality", "metric", "data_quality_summary"), W("automation_performance", "Automation performance", "metric", "automation_performance"), W("approval_delays", "Approval delays", "metric", "approval_delays"), W("ai_usage", "AI usage", "metric", "ai_usage"), W("ai_override_rate", "AI override rate", "metric", "ai_override_rate"), W("audit_logs", "Audit logs", "metric", "audit_summary"), W("integration_health", "Integration health", "metric", "integration_health"), W("sla_breaches", "SLA breaches", "metric", "sla_breaches")]
  }
];

// A dashboard is relevant to a role only when the role can view at least one of
// the dashboard's underlying modules. Cross-functional dashboards declare the
// `dashboards` module, so they remain visible to any role with general dashboard
// access; module-specific dashboards (sales, support, marketing, ...) are gated
// to the roles that actually work in those modules.
function dashboardPermissions(modules: string[]): string[] {
  const codes = new Set<string>();
  for (const module of modules) {
    codes.add(`${module}.view`);
    codes.add(`${module}.view_dashboard`);
  }
  return Array.from(codes);
}

export const dashboardCatalog: DashboardDefinition[] = dashboardSeeds.map((seed) => ({
  ...seed,
  requiredPermissions: dashboardPermissions(seed.modules)
}));

export function findDashboard(key: string): DashboardDefinition | undefined {
  return dashboardCatalog.find((dashboard) => dashboard.key === key);
}

// ----------------------------------------------------------------------------
// Responses
// ----------------------------------------------------------------------------

export interface DashboardSummary {
  key: string;
  name: string;
  category: string;
  description: string;
  widgetCount: number;
  permitted: boolean;
}

export interface DashboardCatalogResponse {
  dashboards: DashboardSummary[];
  categories: string[];
}

export interface DashboardWidgetData {
  key: string;
  label: string;
  type: DashboardWidgetType;
  metricKey: string;
  kind: DashboardWidgetDataKind;
  drilldown: boolean;
  value: number | null;
  unit: string | null;
  breakdown: Array<{ label: string; value: number }>;
  series: Array<{ label: string; value: number }>;
  rows: Array<Record<string, unknown>>;
  note: string | null;
}

export interface DashboardDateFilter {
  from: string | null;
  to: string | null;
}

export interface DashboardDataResponse {
  key: string;
  name: string;
  category: string;
  filter: DashboardDateFilter;
  generatedAt: string;
  widgets: DashboardWidgetData[];
}

export interface DashboardDrilldownResponse {
  dashboardKey: string;
  widgetKey: string;
  rows: Array<Record<string, unknown>>;
  total: number;
}

export interface DashboardExportResponse {
  dashboardKey: string;
  exportedAt: string;
  filter: DashboardDateFilter;
  rows: Array<Record<string, unknown>>;
}

// ----------------------------------------------------------------------------
// Saved views
// ----------------------------------------------------------------------------

export interface DashboardSavedView {
  id: string;
  dashboardKey: string;
  name: string;
  ownerUserId: string;
  isShared: boolean;
  isDefault: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardViewRequestBody {
  name: string;
  config?: Record<string, unknown>;
  isShared?: boolean;
  isDefault?: boolean;
}

export interface UpdateDashboardViewRequestBody {
  name?: string;
  config?: Record<string, unknown>;
  isShared?: boolean;
  isDefault?: boolean;
}

export interface DashboardSavedViewListResponse {
  views: DashboardSavedView[];
}

export interface DashboardSavedViewResponse {
  view: DashboardSavedView;
}
