import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router-dom";
import { authRouting } from "@crm/auth";
import type { PermissionModuleKey } from "@crm/types";
import { AuthSplash } from "./components/auth/auth-splash";
import { AppShell } from "./components/layout/app-shell";
import { AccountDetailPage } from "./pages/account-detail-page";
import { AccountFormPage } from "./pages/account-form-page";
import { AccountsPage } from "./pages/accounts-page";
import { AdminSettingsPage } from "./pages/admin-settings-page";
import { AdminPage } from "./pages/admin-page";
import { AiAssistantPage } from "./pages/ai-assistant-page";
import { AgentRegistryPage } from "./pages/agent-registry-page";
import { PromptRegistryPage } from "./pages/prompt-registry-page";
import { KnowledgeManagerPage } from "./pages/knowledge-manager-page";
import { DocumentUploadPage } from "./pages/document-upload-page";
import { KnowledgeArticleEditorPage } from "./pages/knowledge-article-editor-page";
import { RagConsolePage } from "./pages/rag-console-page";
import { CampaignDetailPage } from "./pages/campaign-detail-page";
import { CampaignFormPage } from "./pages/campaign-form-page";
import { CampaignsPage } from "./pages/campaigns-page";
import { ContactDetailPage } from "./pages/contact-detail-page";
import { ContactFormPage } from "./pages/contact-form-page";
import { ContactsPage } from "./pages/contacts-page";
import { CustomFieldsPage } from "./pages/custom-fields-page";
import { CustomerSuccessPage } from "./pages/customer-success-page";
import { TrainingPage } from "./pages/training-page";
import { DashboardPage } from "./pages/dashboard-page";
import { BusinessDevelopmentPage } from "./pages/business-development-page";
import { InsideSalesWorkspacePage } from "./pages/inside-sales-workspace-page";
import { PartnersPage } from "./pages/partners-page";
import { PresalesPage } from "./pages/presales-page";
import { ResellersPage } from "./pages/resellers-page";
import { LeadDetailPage } from "./pages/lead-detail-page";
import { LeadFormPage } from "./pages/lead-form-page";
import { LeadsPage } from "./pages/leads-page";
import { LoginPage } from "./pages/login-page";
import { ModuleSettingsPage } from "./pages/module-settings-page";
import { OpportunityDetailPage } from "./pages/opportunity-detail-page";
import { OpportunityFormPage } from "./pages/opportunity-form-page";
import { OpportunitiesPage } from "./pages/opportunities-page";
import { SocialDetailPage } from "./pages/social-detail-page";
import { SocialFormPage } from "./pages/social-form-page";
import { SocialPage } from "./pages/social-page";
import { SdrWorkspacePage } from "./pages/sdr-workspace-page";
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
            path: "leads/new",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["leads.create", "leads.configure"]}
                title="Lead creation requires create permissions."
                description="Only roles with lead creation permissions can open the lead form."
                moduleKey="leads"
              >
                <LeadFormPage />
              </PermissionRoute>
            )
          },
          {
            path: "leads/:leadId",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.leads}
                title="Lead detail access is limited by role."
                description="Open this record with a role that includes Leads access."
                moduleKey="leads"
              >
                <LeadDetailPage />
              </PermissionRoute>
            )
          },
          {
            path: "leads/:leadId/edit",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["leads.edit", "leads.configure"]}
                title="Lead editing requires edit permissions."
                description="Only roles with lead editing permissions can update this record."
                moduleKey="leads"
              >
                <LeadFormPage />
              </PermissionRoute>
            )
          },
          {
            path: "sales/sdr",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.salesWorkspaces}
                title="Sales workspace access is limited by role."
                description="Open the SDR workspace with a role that includes lead or sales access."
                moduleKey="sales"
              >
                <SdrWorkspacePage />
              </PermissionRoute>
            )
          },
          {
            path: "sales/inside-sales",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.salesWorkspaces}
                title="Inside sales workspace access is limited by role."
                description="Open the inside sales workspace with a role that includes lead or sales access."
                moduleKey="sales"
              >
                <InsideSalesWorkspacePage />
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
            path: "accounts/new",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["accounts.create", "accounts.configure"]}
                title="Account creation requires create permissions."
                description="Only roles with account creation permissions can open the account form."
                moduleKey="accounts"
              >
                <AccountFormPage />
              </PermissionRoute>
            )
          },
          {
            path: "accounts/:accountId",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.accounts}
                title="Account detail access is limited by role."
                description="Open this record with a role that includes Accounts access."
                moduleKey="accounts"
              >
                <AccountDetailPage />
              </PermissionRoute>
            )
          },
          {
            path: "accounts/:accountId/edit",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["accounts.edit", "accounts.configure"]}
                title="Account editing requires edit permissions."
                description="Only roles with account editing permissions can update this record."
                moduleKey="accounts"
              >
                <AccountFormPage />
              </PermissionRoute>
            )
          },
          {
            path: "contacts",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.contacts}
                title="Contact access is limited by role."
                description="Open this module with a role that includes Contacts access."
                moduleKey="contacts"
              >
                <ContactsPage />
              </PermissionRoute>
            )
          },
          {
            path: "contacts/new",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["contacts.create", "contacts.configure"]}
                title="Contact creation requires create permissions."
                description="Only roles with contact creation permissions can open the contact form."
                moduleKey="contacts"
              >
                <ContactFormPage />
              </PermissionRoute>
            )
          },
          {
            path: "contacts/:contactId",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.contacts}
                title="Contact detail access is limited by role."
                description="Open this record with a role that includes Contacts access."
                moduleKey="contacts"
              >
                <ContactDetailPage />
              </PermissionRoute>
            )
          },
          {
            path: "contacts/:contactId/edit",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["contacts.edit", "contacts.configure"]}
                title="Contact editing requires edit permissions."
                description="Only roles with contact editing permissions can update this record."
                moduleKey="contacts"
              >
                <ContactFormPage />
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
            path: "opportunities/new",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["opportunities.create", "opportunities.configure"]}
                title="Opportunity creation requires create permissions."
                description="Only roles with opportunity creation permissions can open the opportunity form."
                moduleKey="opportunities"
              >
                <OpportunityFormPage />
              </PermissionRoute>
            )
          },
          {
            path: "opportunities/:opportunityId",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.opportunities}
                title="Opportunity detail access is limited by role."
                description="Open this record with a role that includes Opportunities access."
                moduleKey="opportunities"
              >
                <OpportunityDetailPage />
              </PermissionRoute>
            )
          },
          {
            path: "opportunities/:opportunityId/edit",
            element: (
              <PermissionRoute
                requiredPermissionCodes={[
                  "opportunities.edit",
                  "opportunities.assign",
                  "opportunities.approve",
                  "opportunities.configure",
                  "opportunities.manage_workflow"
                ]}
                title="Opportunity editing requires edit, assign, approve, or workflow permissions."
                description="Only roles with opportunity edit, assignment, approval, workflow, or configuration permissions can update this record."
                moduleKey="opportunities"
              >
                <OpportunityFormPage />
              </PermissionRoute>
            )
          },
          {
            path: "business-development",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.businessDevelopment}
                title="Business development access is limited by role."
                description="Open this module with a role that includes Business Development access."
                moduleKey="business_development"
              >
                <BusinessDevelopmentPage />
              </PermissionRoute>
            )
          },
          {
            path: "presales",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.presales}
                title="Presales access is limited by role."
                description="Open this module with a role that includes Presales access."
                moduleKey="presales"
              >
                <PresalesPage />
              </PermissionRoute>
            )
          },
          {
            path: "partners",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.partners}
                title="Partner access is limited by role."
                description="Open this module with a role that includes Partners access."
                moduleKey="partners"
              >
                <PartnersPage />
              </PermissionRoute>
            )
          },
          {
            path: "resellers",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.resellers}
                title="Reseller access is limited by role."
                description="Open this module with a role that includes Resellers access."
                moduleKey="resellers"
              >
                <ResellersPage />
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
            path: "campaigns/new",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["campaigns.create", "campaigns.configure"]}
                title="Campaign creation requires create permissions."
                description="Only roles with campaign creation permissions can open the campaign form."
                moduleKey="campaigns"
              >
                <CampaignFormPage />
              </PermissionRoute>
            )
          },
          {
            path: "campaigns/:campaignId",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.campaigns}
                title="Campaign detail access is limited by role."
                description="Open this record with a role that includes Campaigns access."
                moduleKey="campaigns"
              >
                <CampaignDetailPage />
              </PermissionRoute>
            )
          },
          {
            path: "campaigns/:campaignId/edit",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["campaigns.edit", "campaigns.assign", "campaigns.configure"]}
                title="Campaign editing requires edit or assign permissions."
                description="Only roles with campaign edit or assignment permissions can update the campaign form."
                moduleKey="campaigns"
              >
                <CampaignFormPage />
              </PermissionRoute>
            )
          },
          {
            path: "social",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.social}
                title="Social workspace access is limited by role."
                description="Open this module with a role that includes Social access."
                moduleKey="social"
              >
                <SocialPage />
              </PermissionRoute>
            )
          },
          {
            path: "social/new",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["social.create", "social.configure"]}
                title="Social post creation requires create permissions."
                description="Only roles with social creation permissions can open the social post form."
                moduleKey="social"
              >
                <SocialFormPage />
              </PermissionRoute>
            )
          },
          {
            path: "social/:postId",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.social}
                title="Social post detail access is limited by role."
                description="Open this record with a role that includes Social access."
                moduleKey="social"
              >
                <SocialDetailPage />
              </PermissionRoute>
            )
          },
          {
            path: "social/:postId/edit",
            element: (
              <PermissionRoute
                requiredPermissionCodes={["social.edit", "social.assign", "social.approve", "social.configure"]}
                title="Social post editing requires edit, assign, or approve permissions."
                description="Only roles with social edit, assignment, approval, or configuration permissions can update this record."
                moduleKey="social"
              >
                <SocialFormPage />
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
            path: "training",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.training}
                title="Training access is limited by role."
                description="Open this module with a role that includes Training access."
                moduleKey="training"
              >
                <TrainingPage />
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
          },
          {
            path: "ai-prompts",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.aiAssistant}
                title="Prompt registry access is limited by role."
                description="Open the prompt registry with a role that includes AI access for the tenant."
                moduleKey="ai"
              >
                <PromptRegistryPage />
              </PermissionRoute>
            )
          },
          {
            path: "ai-agents",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.aiAssistant}
                title="Agent registry access is limited by role."
                description="Open the agent registry with a role that includes AI access for the tenant."
                moduleKey="ai"
              >
                <AgentRegistryPage />
              </PermissionRoute>
            )
          },
          {
            path: "knowledge",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.aiAssistant}
                title="Knowledge base access is limited by role."
                description="Open the knowledge base with a role that includes AI access for the tenant."
                moduleKey="ai"
              >
                <KnowledgeManagerPage />
              </PermissionRoute>
            )
          },
          {
            path: "knowledge/upload",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.aiAssistant}
                title="Document upload access is limited by role."
                description="Open document ingestion with a role that includes AI access for the tenant."
                moduleKey="ai"
              >
                <DocumentUploadPage />
              </PermissionRoute>
            )
          },
          {
            path: "knowledge/articles",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.aiAssistant}
                title="Knowledge article access is limited by role."
                description="Open the article editor with a role that includes AI access for the tenant."
                moduleKey="ai"
              >
                <KnowledgeArticleEditorPage />
              </PermissionRoute>
            )
          },
          {
            path: "knowledge/rag-console",
            element: (
              <PermissionRoute
                requiredPermissionCodes={routePermissionRequirements.aiAssistant}
                title="RAG console access is limited by role."
                description="Open the RAG test console with a role that includes AI access for the tenant."
                moduleKey="ai"
              >
                <RagConsolePage />
              </PermissionRoute>
            )
          }
        ]
      }
    ]
  }
]);
