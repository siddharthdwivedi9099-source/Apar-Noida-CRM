import type { NavItem, PermissionModuleKey, TenantTerminologyEntry } from "@crm/types";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  ContactRound,
  GraduationCap,
  PhoneCall,
  PhoneForwarded,
  LayoutDashboard,
  LifeBuoy,
  Handshake,
  Megaphone,
  Presentation,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { routePermissionRequirements } from "@/lib/rbac";

export interface AppNavItem extends NavItem {
  icon: LucideIcon;
  moduleKey: PermissionModuleKey;
  requiredPermissionCodes: readonly string[];
}

export const appNavItems: AppNavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Operational scorecards and rollout overview.",
    icon: LayoutDashboard,
    moduleKey: "dashboards",
    requiredPermissionCodes: routePermissionRequirements.dashboard
  },
  {
    title: "Admin",
    href: "/admin",
    description: "Tenant, platform, and governance controls.",
    icon: ShieldCheck,
    moduleKey: "admin",
    requiredPermissionCodes: routePermissionRequirements.admin
  },
  {
    title: "Leads",
    href: "/leads",
    description: "Lead intake, qualification, and SDR flow.",
    icon: Users,
    moduleKey: "leads",
    requiredPermissionCodes: routePermissionRequirements.leads
  },
  {
    title: "SDR Workspace",
    href: "/sales/sdr",
    description: "Prospecting queue, qualification flow, and lead handoff execution.",
    icon: PhoneCall,
    moduleKey: "sales",
    requiredPermissionCodes: routePermissionRequirements.salesWorkspaces
  },
  {
    title: "Inside Sales",
    href: "/sales/inside-sales",
    description: "Lead queue, call disposition, and conversion handoff workspace.",
    icon: PhoneForwarded,
    moduleKey: "sales",
    requiredPermissionCodes: routePermissionRequirements.salesWorkspaces
  },
  {
    title: "Accounts",
    href: "/accounts",
    description: "Customer and stakeholder system-of-record view.",
    icon: Building2,
    moduleKey: "accounts",
    requiredPermissionCodes: routePermissionRequirements.accounts
  },
  {
    title: "Contacts",
    href: "/contacts",
    description: "Stakeholder identities and account relationships.",
    icon: ContactRound,
    moduleKey: "contacts",
    requiredPermissionCodes: routePermissionRequirements.contacts
  },
  {
    title: "Opportunities",
    href: "/opportunities",
    description: "Revenue progression and deal collaboration.",
    icon: BriefcaseBusiness,
    moduleKey: "opportunities",
    requiredPermissionCodes: routePermissionRequirements.opportunities
  },
  {
    title: "Business Development",
    href: "/business-development",
    description: "Strategic account targeting, relationship mapping, and BD pipeline.",
    icon: Target,
    moduleKey: "business_development",
    requiredPermissionCodes: routePermissionRequirements.businessDevelopment
  },
  {
    title: "Presales",
    href: "/presales",
    description: "Presales intake, RFP/RFI tracking, and proposal workspace.",
    icon: Presentation,
    moduleKey: "presales",
    requiredPermissionCodes: routePermissionRequirements.presales
  },
  {
    title: "Partners",
    href: "/partners",
    description: "Partner profiles, onboarding, deal registration, and channel performance.",
    icon: Handshake,
    moduleKey: "partners",
    requiredPermissionCodes: routePermissionRequirements.partners
  },
  {
    title: "Resellers",
    href: "/resellers",
    description: "Reseller profiles, pricing tiers, onboarding, and deal registration.",
    icon: ShoppingBag,
    moduleKey: "resellers",
    requiredPermissionCodes: routePermissionRequirements.resellers
  },
  {
    title: "Campaigns",
    href: "/campaigns",
    description: "Marketing and multi-channel campaign coordination.",
    icon: Megaphone,
    moduleKey: "campaigns",
    requiredPermissionCodes: routePermissionRequirements.campaigns
  },
  {
    title: "Social",
    href: "/social",
    description: "Social calendars, approvals, and channel planning.",
    icon: CalendarRange,
    moduleKey: "social",
    requiredPermissionCodes: routePermissionRequirements.social
  },
  {
    title: "Support",
    href: "/support",
    description: "Ticketing and service response placeholder.",
    icon: LifeBuoy,
    moduleKey: "support",
    requiredPermissionCodes: routePermissionRequirements.support
  },
  {
    title: "Customer Success",
    href: "/customer-success",
    description: "Health, onboarding, and retention planning.",
    icon: BarChart3,
    moduleKey: "customer_success",
    requiredPermissionCodes: routePermissionRequirements.customerSuccess
  },
  {
    title: "Training",
    href: "/training",
    description: "Training programs, lessons, assignments, and the learner portal.",
    icon: GraduationCap,
    moduleKey: "training",
    requiredPermissionCodes: routePermissionRequirements.training
  },
  {
    title: "AI Assistant",
    href: "/ai-assistant",
    description: "Gateway, prompts, agents, and RAG readiness.",
    icon: Sparkles,
    moduleKey: "ai",
    requiredPermissionCodes: routePermissionRequirements.aiAssistant
  },
  {
    title: "Prompt Registry",
    href: "/ai-prompts",
    description: "Versioned, approval-gated prompt registry with guardrails.",
    icon: ScrollText,
    moduleKey: "ai",
    requiredPermissionCodes: routePermissionRequirements.aiAssistant
  },
  {
    title: "Agent Registry",
    href: "/ai-agents",
    description: "Governed AI agents, tools, roles, scope, and escalation.",
    icon: Bot,
    moduleKey: "ai",
    requiredPermissionCodes: routePermissionRequirements.aiAssistant
  }
];

export function getCurrentNavItem(pathname: string) {
  return (
    appNavItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? appNavItems[0]
  );
}

export function getNavItemLabel(
  item: AppNavItem,
  terminology: TenantTerminologyEntry[],
  form: "singular" | "plural" = "plural"
) {
  const terminologyEntry = terminology.find((entry) => entry.moduleKey === item.moduleKey);

  if (!terminologyEntry) {
    return item.title;
  }

  return form === "singular" ? terminologyEntry.singular : terminologyEntry.plural;
}

export function getVisibleNavItems(
  permissionCodes: string[],
  enabledModuleKeys: Set<PermissionModuleKey>
) {
  return appNavItems.filter(
    (item) =>
      enabledModuleKeys.has(item.moduleKey) &&
      item.requiredPermissionCodes.some((permissionCode) => permissionCodes.includes(permissionCode))
  );
}
