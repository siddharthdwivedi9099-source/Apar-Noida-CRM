import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bell, LogOut, Menu, Palette, Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCurrentNavItem, getNavItemLabel, getVisibleNavItems } from "@/components/navigation/nav-items";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TopbarProps {
  onOpenMobileSidebar: () => void;
}

export function Topbar({ onOpenMobileSidebar }: TopbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const currentPage = getCurrentNavItem(pathname);
  const { user, logout, hasAnyPermission } = useAuth();
  const { settings, terminology, modules } = useTenantConfig();
  const canConfigureAdmin = hasAnyPermission(["admin.edit", "admin.configure"]);
  const canViewNotifications = hasAnyPermission(["notifications.view", "notifications.edit", "notifications.configure"]);

  const [query, setQuery] = useState("");
  const [openResults, setOpenResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const navItems = useMemo(
    () =>
      getVisibleNavItems(
        user?.permissionCodes ?? [],
        new Set(modules.filter((module) => module.enabled).map((module) => module.moduleKey))
      ),
    [user?.permissionCodes, modules]
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return navItems
      .filter((item) => {
        const label = getNavItemLabel(item, terminology).toLowerCase();
        return label.includes(term) || item.description.toLowerCase().includes(term) || item.href.toLowerCase().includes(term);
      })
      .slice(0, 7);
  }, [query, navItems, terminology]);

  // Cmd/Ctrl+K focuses the quick-nav from anywhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setOpenResults(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close the results when clicking outside.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenResults(false);
      }
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  function go(href: string) {
    setQuery("");
    setOpenResults(false);
    navigate(href);
  }

  return (
    <header className="workspace-topbar-panel sticky top-0 z-20 flex items-center gap-4 rounded-[1.5rem] px-4 py-4">
      <Button className="md:hidden" size="icon" variant="ghost" onClick={onOpenMobileSidebar}>
        <Menu className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{settings.workspaceName || "Workspace"}</p>
        <h1 className="truncate font-display text-2xl font-semibold tracking-tight">
          {getNavItemLabel(currentPage, terminology)}
        </h1>
      </div>

      <div ref={containerRef} className="relative hidden flex-1 items-center justify-end lg:flex">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            className="pl-9 pr-14"
            placeholder="Jump to a workspace…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpenResults(true);
              setActiveIndex(0);
            }}
            onFocus={() => setOpenResults(true)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                go(results[activeIndex].href);
              }
            }}
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-background/80 px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
            ⌘K
          </kbd>

          {openResults && results.length > 0 ? (
            <div className="glass-panel absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl p-2 shadow-panel">
              {results.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                      index === activeIndex ? "bg-primary/10 text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <span className="icon-chip-soft h-9 w-9">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-foreground">{getNavItemLabel(item, terminology)}</span>
                      <span className="block truncate text-xs">{item.description}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 opacity-50" />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {canViewNotifications ? (
          <Button variant="outline" size="icon" asChild>
            <Link to="/notifications" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
        {canConfigureAdmin ? (
          <Button variant="outline" size="icon" asChild>
            <Link to="/admin/theme" aria-label="Theme settings">
              <Palette className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
        <div className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-background/60 py-1.5 pl-1.5 pr-3">
          <Avatar name={user?.displayName} size="sm" />
          <div className="hidden text-left md:block">
            <p className="max-w-[10rem] truncate text-sm font-semibold leading-tight">{user?.displayName ?? "Signed in"}</p>
            <p className="max-w-[10rem] truncate text-xs text-muted-foreground">{user?.tenant.name ?? settings.workspaceName}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void logout()} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
