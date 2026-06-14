import { platformMetadata } from "@crm/config";
import { shellLayout } from "@crm/ui";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { appNavItems } from "@/components/navigation/nav-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile
}: SidebarProps) {
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
          "fixed inset-y-4 left-4 z-40 flex rounded-[1.75rem] border border-white/50 bg-white/88 backdrop-blur-xl shadow-panel transition-all duration-300 dark:border-white/10 dark:bg-slate-950/88",
          mobileOpen ? "translate-x-0" : "-translate-x-[120%] md:translate-x-0"
        )}
        style={{
          width: collapsed ? shellLayout.sidebarCollapsedWidth : shellLayout.sidebarWidth
        }}
      >
        <div className="flex w-full flex-col gap-6 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className={cn("space-y-2", collapsed && "md:hidden")}>
              <Badge variant="success">Phase 1</Badge>
              <div>
                <p className="font-display text-lg font-semibold">{platformMetadata.name}</p>
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

          <nav className="flex flex-1 flex-col gap-2">
            {appNavItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.href}
                  end
                  to={item.href}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition",
                      isActive
                        ? "bg-slate-950 text-white shadow-lg dark:bg-primary dark:text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                    )
                  }
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/50 shadow-sm dark:bg-slate-900/50">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className={cn("min-w-0", collapsed && "md:hidden")}>
                    <p className="truncate font-semibold">{item.title}</p>
                    <p className="truncate text-xs opacity-80">{item.description}</p>
                  </div>
                </NavLink>
              );
            })}
          </nav>

          <div className={cn("rounded-2xl bg-background/70 p-4", collapsed && "md:hidden")}>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Foundation</p>
            <p className="mt-2 text-sm font-medium">Responsive shell, shared packages, and API wiring are live.</p>
          </div>
        </div>
      </aside>
    </>
  );
}

