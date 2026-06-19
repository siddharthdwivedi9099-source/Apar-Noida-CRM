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
  }
];

function dashboardPermissions(modules: string[]): string[] {
  const codes = new Set<string>(["dashboards.view", "dashboards.view_dashboard", "dashboards.manage_workflow"]);
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
