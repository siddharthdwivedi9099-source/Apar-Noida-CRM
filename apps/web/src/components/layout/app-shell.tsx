import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed((currentValue) => !currentValue)}
      />
      <div
        className={cn(
          "min-h-screen px-4 pb-6 pt-4 transition-all duration-300 md:px-6 md:pb-8 md:pt-4",
          sidebarCollapsed ? "md:pl-[6.75rem]" : "md:pl-[20.5rem]"
        )}
      >
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1500px] flex-col gap-6">
          <Topbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
