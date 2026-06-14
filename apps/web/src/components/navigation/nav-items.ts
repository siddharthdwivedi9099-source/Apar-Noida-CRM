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

export interface AppNavItem extends NavItem {
  icon: LucideIcon;
}

export const appNavItems: AppNavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Operational scorecards and rollout overview.",
    icon: LayoutDashboard
  },
  {
    title: "Admin",
    href: "/admin",
    description: "Tenant, platform, and governance controls.",
    icon: ShieldCheck
  },
  {
    title: "Leads",
    href: "/leads",
    description: "Lead intake, qualification, and SDR flow.",
    icon: Users
  },
  {
    title: "Accounts",
    href: "/accounts",
    description: "Customer and stakeholder system-of-record view.",
    icon: Building2
  },
  {
    title: "Opportunities",
    href: "/opportunities",
    description: "Revenue progression and deal collaboration.",
    icon: BriefcaseBusiness
  },
  {
    title: "Campaigns",
    href: "/campaigns",
    description: "Marketing and multi-channel campaign coordination.",
    icon: Megaphone
  },
  {
    title: "Support",
    href: "/support",
    description: "Ticketing and service response placeholder.",
    icon: LifeBuoy
  },
  {
    title: "Customer Success",
    href: "/customer-success",
    description: "Health, onboarding, and retention planning.",
    icon: BarChart3
  },
  {
    title: "AI Assistant",
    href: "/ai-assistant",
    description: "Gateway, prompts, agents, and RAG readiness.",
    icon: Sparkles
  }
];

export function getCurrentNavItem(pathname: string) {
  return appNavItems.find((item) => item.href === pathname) ?? appNavItems[0];
}

