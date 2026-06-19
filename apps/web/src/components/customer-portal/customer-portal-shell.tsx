import { NavLink, Outlet } from "react-router-dom";
import { Bot, BookOpen, GraduationCap, LayoutDashboard, LifeBuoy, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";

const portalNavItems = [
  { title: "Dashboard", href: "/portal/dashboard", icon: LayoutDashboard },
  { title: "Tickets", href: "/portal/tickets", icon: LifeBuoy },
  { title: "Knowledge", href: "/portal/knowledge", icon: BookOpen },
  { title: "Ask AI", href: "/portal/ask-ai", icon: Bot },
  { title: "Training", href: "/portal/training", icon: GraduationCap },
  { title: "Profile", href: "/portal/profile", icon: UserRound }
];

export function CustomerPortalShell() {
  const { logout, user } = useAuth();
  const { settings } = useTenantConfig();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_34rem),linear-gradient(135deg,rgba(248,250,252,0.95),rgba(239,246,255,0.9))] px-4 py-4 dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_34rem),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92))] md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1280px] flex-col gap-5">
        <header className="glass-panel flex flex-col gap-4 rounded-[1.75rem] p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Customer Portal</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{settings.workspaceName}</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {user?.displayName ?? "Customer"}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {portalNavItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-white/55 text-foreground hover:bg-white/80 dark:bg-slate-950/35 dark:hover:bg-slate-900/70"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </NavLink>
              );
            })}
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
