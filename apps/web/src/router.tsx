import { Navigate, createBrowserRouter } from "react-router-dom";
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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />
  },
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/",
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
]);

