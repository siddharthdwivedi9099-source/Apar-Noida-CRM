import { Palette, Settings2, ShieldCheck, Shapes, SlidersHorizontal, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const adminNavItems: AdminNavItem[] = [
  {
    href: "/admin",
    title: "Settings Home",
    description: "Workspace profile and configuration summary.",
    icon: Settings2
  },
  {
    href: "/admin/theme",
    title: "Theme",
    description: "Branding, colors, density, and layout look-and-feel.",
    icon: Palette
  },
  {
    href: "/admin/modules",
    title: "Modules",
    description: "Enable or disable tenant modules and navigation surfaces.",
    icon: SlidersHorizontal
  },
  {
    href: "/admin/terminology",
    title: "Terminology",
    description: "Rename business-facing labels like Leads and Accounts.",
    icon: Type
  },
  {
    href: "/admin/custom-fields",
    title: "Custom Fields",
    description: "Manage field metadata and form-layout foundations.",
    icon: Shapes
  },
  {
    href: "/admin/rbac",
    title: "RBAC",
    description: "Roles, permissions, and user assignment controls.",
    icon: ShieldCheck
  }
];

export function AdminNav() {
  return (
    <nav className="grid gap-3 xl:grid-cols-6">
      {adminNavItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.href}
            end
            to={item.href}
            className={({ isActive }) =>
              cn(
                "glass-panel rounded-[1.5rem] p-4 transition",
                isActive ? "border-primary/50 shadow-lg" : "hover:border-primary/20"
              )
            }
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </div>
            </div>
          </NavLink>
        );
      })}
    </nav>
  );
}
