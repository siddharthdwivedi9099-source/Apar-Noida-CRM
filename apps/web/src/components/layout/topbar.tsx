import { environmentGuidance } from "@crm/config";
import { LogOut, Menu, MoonStar, Search, SunMedium } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getCurrentNavItem } from "@/components/navigation/nav-items";
import { useAuth } from "@/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/providers/theme-provider";

interface TopbarProps {
  onOpenMobileSidebar: () => void;
}

export function Topbar({ onOpenMobileSidebar }: TopbarProps) {
  const { pathname } = useLocation();
  const currentPage = getCurrentNavItem(pathname);
  const { theme, toggleTheme } = useTheme();
  const { user, session, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 rounded-[1.5rem] border border-white/50 bg-white/70 px-4 py-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/72">
      <Button className="md:hidden" size="icon" variant="ghost" onClick={onOpenMobileSidebar}>
        <Menu className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Workspace</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="truncate font-display text-2xl font-semibold">{currentPage.title}</h1>
          <Badge variant="muted">API /api/v1</Badge>
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-end lg:flex">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search foundation pages, docs, and future modules" />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right md:block">
          <p className="text-sm font-medium">{user?.displayName ?? "Authenticated user"}</p>
          <p className="text-xs text-muted-foreground">
            {user?.tenant.name ?? "Tenant workspace"}
            {session ? ` · Session ${session.id.slice(0, 8)}` : ""}
          </p>
        </div>
        <Badge variant="muted">Web {environmentGuidance.webPort}</Badge>
        <Button variant="outline" size="icon" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={toggleTheme}>
          {theme === "light" ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
