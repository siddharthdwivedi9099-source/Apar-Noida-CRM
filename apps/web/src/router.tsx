import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router-dom";
import { authRouting } from "@crm/auth";
import type { PermissionModuleKey } from "@crm/types";
import { AuthSplash } from "./components/auth/auth-splash";
import { AppShell } from "./components/layout/app-shell";
import { AccountsPage } from "./pages/accounts-page";
import { AdminSettingsPage } from "./pages/admin-settings-page";
import { AdminPage } from "./pages/admin-page";
import { AiAssistantPage } from "./pages/ai-assistant-page";
import { CampaignsPage } from "./pages/campaigns-page";
import { CustomFieldsPage } from "./pages/custom-fields-page";
import { CustomerSuccessPage } from "./pages/customer-success-page";
import { DashboardPage } from "./pages/dashboard-page";
import { LeadsPage } from "./pages/leads-page";
import { LoginPage } from "./pages/login-page";
import { ModuleSettingsPage } from "./pages/module-settings-page";
import { OpportunitiesPage } from "./pages/opportunities-page";
import { ThemeSettingsPage } from "./pages/theme-settings-page";
import { TerminologySettingsPage } from "./pages/terminology-settings-page";
import { SupportPage } from "./pages/support-page";
import { UnauthorizedPage } from "./pages/unauthorized-page";
import { routePermissionRequirements } from "./lib/rbac";
import { useAuth } from "./providers/auth-provider";
import { useTenantConfig } from "./providers/tenant-config-provider";

function RootRedirect() {
  const { status, isAuthenticated } = useAuth();

  if (status === "loading") {
    return (
      <AuthSplash
        title="Checking your workspace access"
        description="Loading your current session before routing you into the tenant workspace."
      />
    );
  }

  return <Navigate to={isAuthenticated ? authRouting.defaultAuthenticatedRoute : authRouting.login} replace />;
}

function LoginRoute() {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <AuthSplash
        title="Restoring your session"
        description="We are checking for an active refresh token before showing the login form."
      />
    );
  }

  if (isAuthenticated) {
    const redirectTarget =
      ((location.state as { from?: string } | null)?.from ?? authRouting.defaultAuthenticatedRoute);

    return <Navigate to={redirectTarget} replace />;
  }

  return <LoginPage />;
}

function ProtectedRoute() {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <AuthSplash
        title="Loading your secure workspace"
        description="Current user details are loading so protected routes can enforce tenant-aware access."
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={authRouting.login} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

interface PermissionRouteProps {
  requiredPermissionCodes: readonly string[];
  title: string;
  description: string;
  moduleKey?: PermissionModuleKey;
  children: JSX.Element;
}

function PermissionRoute({
  requiredPermissionCodes,
  title,
  description,
  moduleKey,
  children
}: PermissionRouteProps) {
  const { user } = useAuth();
  const tenantConfig = useTenantConfig();
  const permissionCodes = user?.permissionCodes ?? [];
  const isAllowed = requiredPermissionCodes.some((permissionCode) => permissionCodes.includes(permissionCode));

  if (tenantConfig.status === "loading") {
    return (
      <AuthSplash
        title="Loading tenant configuration"
        description="Applying tenant theme, module switches, and terminology before opening this route."
      />
    );
  }

  if (moduleKey && !tenantConfig.isModuleEnabled(moduleKey)) {
    return (
      <UnauthorizedPage
        title={`${tenantConfig.getModuleLabel(moduleKey)} is currently disabled for this tenant.`}
        description="A tenant administrator has switched this module off in module settings, so it is hidden from the live workspace."
      />
    );
  }

  if (!isAllowed) {
    return <UnauthorizedPage title={title} description={description} />;
  }

  return children;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />
  },
  {
    path: "/login",
    element: <LoginRoute />
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: "dashboard",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.dashboard}
                title="Dashboard access is limited by role."
                description="Your current role set does not include dashboard visibility for this tenant."
                moduleKey="dashboards"
              >
                <DashboardPage />
              </PermissionRoute>
            )
          },
          {
            path: "admin",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.admin}
                title="Admin controls require administrative permissions."
                description="Role management, permission assignment, and tenant governance are only available to authorized admins."
                moduleKey="admin"
              >
                <AdminSettingsPage />
              </PermissionRoute>
            )
          },
          {
            path: "admin/theme",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.admin}
                title="Theme configuration requires administrative permissions."
                description="Only authorized admins can update tenant branding and shell presentation."
                moduleKey="admin"
              >
                <ThemeSettingsPage />
              </PermissionRoute>
            )
          },
          {
            path: "admin/modules",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.admin}
                title="Module configuration requires administrative permissions."
                description="Only authorized admins can enable or disable tenant modules."
                moduleKey="admin"
              >
                <ModuleSettingsPage />
              </PermissionRoute>
            )
          },
          {
            path: "admin/terminology",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.admin}
                title="Terminology configuration requires administrative permissions."
                description="Only authorized admins can rename business-facing labels for the tenant."
                moduleKey="admin"
              >
                <TerminologySettingsPage />
              </PermissionRoute>
            )
          },
          {
            path: "admin/custom-fields",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.admin}
                title="Custom field configuration requires administrative permissions."
                description="Only authorized admins can manage custom field metadata and layout foundations."
                moduleKey="admin"
              >
                <CustomFieldsPage />
              </PermissionRoute>
            )
          },
          {
            path: "admin/rbac",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.admin}
                title="RBAC controls require administrative permissions."
                description="Only authorized admins can manage roles, permissions, and user assignments."
                moduleKey="admin"
              >
                <AdminPage />
              </PermissionRoute>
            )
          },
          {
            path: "leads",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.leads}
                title="Lead access is limited by role."
                description="Open this module with a role that includes Leads access."
                moduleKey="leads"
              >
                <LeadsPage />
              </PermissionRoute>
            )
          },
          {
            path: "accounts",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.accounts}
                title="Account access is limited by role."
                description="Open this module with a role that includes Accounts access."
                moduleKey="accounts"
              >
                <AccountsPage />
              </PermissionRoute>
            )
          },
          {
            path: "opportunities",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.opportunities}
                title="Opportunity access is limited by role."
                description="Open this module with a role that includes Opportunities access."
                moduleKey="opportunities"
              >
                <OpportunitiesPage />
              </PermissionRoute>
            )
          },
          {
            path: "campaigns",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.campaigns}
                title="Campaign access is limited by role."
                description="Open this module with a role that includes Campaigns access."
                moduleKey="campaigns"
              >
                <CampaignsPage />
              </PermissionRoute>
            )
          },
          {
            path: "support",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.support}
                title="Support access is limited by role."
                description="Open this module with a role that includes Support access."
                moduleKey="support"
              >
                <SupportPage />
              </PermissionRoute>
            )
          },
          {
            path: "customer-success",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.customerSuccess}
                title="Customer success access is limited by role."
                description="Open this module with a role that includes Customer Success access."
                moduleKey="customer_success"
              >
                <CustomerSuccessPage />
              </PermissionRoute>
            )
          },
          {
            path: "ai-assistant",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.aiAssistant}
                title="AI access is limited by role."
                description="Open this module with a role that includes AI access for the tenant."
                moduleKey="ai"
              >
                <AiAssistantPage />
              </PermissionRoute>
            )
          }
        ]
      }
    ]
  }
]);
