import type { NavItem } from "@crm/types";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { routePermissionRequirements } from "@/lib/rbac";

export interface AppNavItem extends NavItem {
  icon: LucideIcon;
  requiredPermissionCodes: readonly string[];
}

export const appNavItems: AppNavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Operational scorecards and rollout overview.",
    icon: LayoutDashboard,
    requiredPermissionCodes: routePermissionRequirements.dashboard
  },
  {
    title: "Admin",
    href: "/admin",
    description: "Tenant, platform, and governance controls.",
    icon: ShieldCheck,
    requiredPermissionCodes: routePermissionRequirements.admin
  },
  {
    title: "Leads",
    href: "/leads",
    description: "Lead intake, qualification, and SDR flow.",
    icon: Users,
    requiredPermissionCodes: routePermissionRequirements.leads
  },
  {
    title: "Accounts",
    href: "/accounts",
    description: "Customer and stakeholder system-of-record view.",
    icon: Building2,
    requiredPermissionCodes: routePermissionRequirements.accounts
  },
  {
    title: "Opportunities",
    href: "/opportunities",
    description: "Revenue progression and deal collaboration.",
    icon: BriefcaseBusiness,
    requiredPermissionCodes: routePermissionRequirements.opportunities
  },
  {
    title: "Campaigns",
    href: "/campaigns",
    description: "Marketing and multi-channel campaign coordination.",
    icon: Megaphone,
    requiredPermissionCodes: routePermissionRequirements.campaigns
  },
  {
    title: "Support",
    href: "/support",
    description: "Ticketing and service response placeholder.",
    icon: LifeBuoy,
    requiredPermissionCodes: routePermissionRequirements.support
  },
  {
    title: "Customer Success",
    href: "/customer-success",
    description: "Health, onboarding, and retention planning.",
    icon: BarChart3,
    requiredPermissionCodes: routePermissionRequirements.customerSuccess
  },
  {
    title: "AI Assistant",
    href: "/ai-assistant",
    description: "Gateway, prompts, agents, and RAG readiness.",
    icon: Sparkles,
    requiredPermissionCodes: routePermissionRequirements.aiAssistant
  }
];

export function getCurrentNavItem(pathname: string) {
  return appNavItems.find((item) => item.href === pathname) ?? appNavItems[0];
}

export function getVisibleNavItems(permissionCodes: string[]) {
  return appNavItems.filter((item) =>
    item.requiredPermissionCodes.some((permissionCode) => permissionCodes.includes(permissionCode))
  );
}
