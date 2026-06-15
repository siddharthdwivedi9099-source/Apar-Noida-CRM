import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router-dom";
import { authRouting } from "@crm/auth";
import { AuthSplash } from "./components/auth/auth-splash";
import { AppShell } from "./components/layout/app-shell";
import { AccountsPage } from "./pages/accounts-page";
import { AdminPage } from "./pages/admin-page";
import { AiAssistantPage } from "./pages/ai-assistant-page";
import { CampaignsPage } from "./pages/campaigns-page";
import { CustomerSuccessPage } from "./pages/customer-success-page";
import { DashboardPage } from "./pages/dashboard-page";
import { LeadsPage } from "./pages/leads-page";
import { LoginPage } from "./pages/login-page";
import { OpportunitiesPage } from "./pages/opportunities-page";
import { SupportPage } from "./pages/support-page";
import { useAuth } from "./providers/auth-provider";

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
            element: <DashboardPage />
          },
          {
            path: "admin",
            element: <AdminPage />
          },
          {
            path: "leads",
            element: <LeadsPage />
          },
          {
            path: "accounts",
            element: <AccountsPage />
          },
          {
            path: "opportunities",
            element: <OpportunitiesPage />
          },
          {
            path: "campaigns",
            element: <CampaignsPage />
          },
          {
            path: "support",
            element: <SupportPage />
          },
          {
            path: "customer-success",
            element: <CustomerSuccessPage />
          },
          {
            path: "ai-assistant",
            element: <AiAssistantPage />
          }
        ]
      }
    ]
  }
]);
