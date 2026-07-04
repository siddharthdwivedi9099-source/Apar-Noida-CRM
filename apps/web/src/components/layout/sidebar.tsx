import { useEffect, useMemo, useState } from "react";
import { platformMetadata } from "@crm/config";
import { shellLayout } from "@crm/ui";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  getNavItemLabel,
  getVisibleNavItems,
  navGroupLabels,
  type AppNavItem,
  type NavGroupKey
} from "@/components/navigation/nav-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

const groupOrder: NavGroupKey[] = [
  "overview",
  "sales",
  "marketing",
  "partners",
  "service",
  "knowledge",
  "ai",
  "operations",
  "admin",
  "portal"
];

function groupForPath(items: AppNavItem[], pathname: string): NavGroupKey | null {
  const match = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.group ?? null;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile
}: SidebarProps) {
  const { user } = useAuth();
  const { theme, settings, modules, terminology } = useTenantConfig();
  const { pathname } = useLocation();
  const navItems = getVisibleNavItems(
    user?.permissionCodes ?? [],
    new Set(modules.filter((module) => module.enabled).map((module) => module.moduleKey))
  );

  const groups = useMemo(() => {
    const byGroup = new Map<NavGroupKey, AppNavItem[]>();
    for (const item of navItems) {
      const list = byGroup.get(item.group) ?? [];
      list.push(item);
      byGroup.set(item.group, list);
    }
    return groupOrder.filter((key) => byGroup.has(key)).map((key) => ({ key, items: byGroup.get(key)! }));
  }, [navItems]);

  const activeGroup = groupForPath(navItems, pathname);
  const [openGroups, setOpenGroups] = useState<Set<NavGroupKey>>(
    () => new Set(activeGroup ? [activeGroup] : ["overview"])
  );

  // Keep the group of the current route open when navigating (e.g. via ⌘K).
  useEffect(() => {
    if (activeGroup) {
      setOpenGroups((current) => (current.has(activeGroup) ? current : new Set(current).add(activeGroup)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]);

  function toggleGroup(key: NavGroupKey) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function renderLeafLink(item: AppNavItem, compact: boolean) {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.href}
        end
        to={item.href}
        onClick={onCloseMobile}
        title={collapsed ? getNavItemLabel(item, terminology) : undefined}
        className={({ isActive }) =>
          cn(
            "group relative flex items-center gap-3 rounded-2xl text-sm transition-all duration-200 ease-out hover:translate-x-0.5",
            compact ? "px-3 py-2" : "px-3 py-2.5",
            isActive
              ? "text-primary-foreground shadow-lg shadow-primary/25 [background-image:linear-gradient(135deg,hsl(var(--primary)),rgb(var(--hero-accent-rgb)))]"
              : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          )
        }
      >
        {({ isActive }) => (
          <>
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl shadow-sm transition group-hover:scale-105",
                compact ? "h-8 w-8" : "h-9 w-9",
                isActive ? "bg-white/25 text-primary-foreground" : "bg-white/50 dark:bg-slate-900/50"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className={cn("min-w-0 truncate font-semibold", collapsed && "md:hidden")}>
              {getNavItemLabel(item, terminology)}
            </span>
          </>
        )}
      </NavLink>
    );
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-sm transition md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onCloseMobile}
      />
      <aside
        className={cn(
          "workspace-sidebar-panel fixed inset-y-4 left-4 z-40 flex overflow-hidden rounded-[1.75rem] transition-all duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-[120%] md:translate-x-0"
        )}
        style={{
          width: collapsed ? shellLayout.sidebarCollapsedWidth : shellLayout.sidebarWidth
        }}
      >
        <div className="flex h-full w-full min-h-0 flex-col gap-6 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className={cn("space-y-2", collapsed && "md:hidden")}>
              <Badge variant="success">{platformMetadata.currentPhase.split(":")[0]}</Badge>
              <div>
                {theme.logo ? (
                  <img
                    src={theme.logo}
                    alt={`${settings.workspaceName} logo`}
                    className="mb-3 h-10 w-auto rounded-xl object-contain"
                  />
                ) : null}
                <p className="font-display text-lg font-semibold">{settings.workspaceName}</p>
                <p className="text-sm text-muted-foreground">{platformMetadata.currentPhase}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="hidden md:inline-flex"
                variant="ghost"
                size="icon"
                onClick={onToggleCollapsed}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
              <Button className="md:hidden" variant="ghost" size="icon" onClick={onCloseMobile}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1">
            {collapsed
              ? // Icon rail: flat, tooltipped links (group headers need labels).
                navItems.map((item) => renderLeafLink(item, true))
              : groups.map((group) => {
                  // Single-item groups render as a plain top-level link.
                  if (group.items.length === 1) {
                    return renderLeafLink(group.items[0], false);
                  }
                  const isOpen = openGroups.has(group.key);
                  const containsActive = group.key === activeGroup;
                  return (
                    <div key={group.key} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={isOpen}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.16em] transition hover:bg-secondary/60",
                          containsActive ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        <ChevronDown
                          className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", !isOpen && "-rotate-90")}
                        />
                        <span className="flex-1">{navGroupLabels[group.key]}</span>
                        <span className="rounded-full bg-secondary/70 px-1.5 py-0.5 text-[0.62rem] font-semibold normal-case tracking-normal text-muted-foreground">
                          {group.items.length}
                        </span>
                      </button>
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-out",
                          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}
                      >
                        <div className="min-h-0 space-y-1 overflow-hidden pl-2">
                          {group.items.map((item) => renderLeafLink(item, true))}
                        </div>
                      </div>
                    </div>
                  );
                })}
          </nav>

          <div className={cn("rounded-2xl bg-background/70 p-4", collapsed && "md:hidden")}>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{platformMetadata.name}</p>
            <p className="mt-2 text-sm font-medium">
              Navigation follows your role permissions and the tenant&apos;s module configuration.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
