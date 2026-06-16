import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type {
  PermissionModuleKey,
  TenantConfigurationBootstrapResponse,
  TenantConfigurationSummary,
  TenantCoreSettings,
  TenantModuleState,
  TenantTerminologyEntry,
  TenantThemeSettings
} from "@crm/types";
import {
  defaultTenantCoreSettings,
  defaultTenantTerminologyEntries,
  defaultTenantThemeSettings,
  permissionModuleLabels,
  tenantModuleDefinitions
} from "@crm/types";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { useAuth } from "./auth-provider";

type TenantConfigStatus = "idle" | "loading" | "ready" | "error";

interface TenantConfigContextValue {
  status: TenantConfigStatus;
  errorMessage: string | null;
  tenant: TenantConfigurationBootstrapResponse["tenant"] | null;
  settings: TenantCoreSettings;
  theme: TenantThemeSettings;
  modules: TenantModuleState[];
  terminology: TenantTerminologyEntry[];
  summary: TenantConfigurationSummary;
  reload: () => Promise<void>;
  isModuleEnabled: (moduleKey: PermissionModuleKey) => boolean;
  getModuleLabel: (moduleKey: PermissionModuleKey, form?: "singular" | "plural") => string;
}

const defaultModules = tenantModuleDefinitions.map((definition) => ({
  ...definition,
  enabled: definition.defaultEnabled
}));

const defaultSummary: TenantConfigurationSummary = {
  optionSetCount: 0,
  pipelineCount: 0,
  ticketStatusCount: 0,
  customerSuccessStageCount: 0,
  customFieldCount: 0,
  formLayoutCount: 0
};

const TenantConfigContext = createContext<TenantConfigContextValue | undefined>(undefined);

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function hexToRgbTriplet(hexColor: string) {
  const normalized = hexColor.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `${red} ${green} ${blue}`;
}

function hexToHsl(hexColor: string) {
  const normalized = hexColor.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(lightness * 100)}%`;
  }

  const difference = max - min;
  const saturation =
    lightness > 0.5 ? difference / (2 - max - min) : difference / (max + min);

  let hue = 0;

  switch (max) {
    case red:
      hue = (green - blue) / difference + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / difference + 2;
      break;
    default:
      hue = (red - green) / difference + 4;
      break;
  }

  hue /= 6;

  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function pickForegroundHsl(hexColor: string) {
  const normalized = hexColor.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 160 ? "215 42% 12%" : "35 100% 98%";
}

function getFontFamilies(preference: TenantThemeSettings["fontPreference"]) {
  switch (preference) {
    case "classic":
      return {
        sans: "\"Source Serif 4\", \"Georgia\", serif",
        display: "\"Fraunces\", \"Source Serif 4\", serif"
      };
    case "system":
      return {
        sans: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        display: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
      };
    default:
      return {
        sans: "\"Avenir Next\", \"Segoe UI\", system-ui, sans-serif",
        display: "\"Space Grotesk\", \"Avenir Next\", system-ui, sans-serif"
      };
  }
}

function applyThemeToDocument(theme: TenantThemeSettings) {
  const root = document.documentElement;
  const isDarkMode = theme.mode === "dark";
  const fonts = getFontFamilies(theme.fontPreference);

  root.classList.toggle("dark", isDarkMode);
  root.dataset.sidebarStyle = theme.sidebarStyle;
  root.dataset.cardStyle = theme.cardStyle;
  root.dataset.fontPreference = theme.fontPreference;
  root.dataset.density = theme.density;

  root.style.setProperty("--primary", hexToHsl(theme.primaryColor));
  root.style.setProperty("--primary-foreground", pickForegroundHsl(theme.primaryColor));
  root.style.setProperty("--secondary", hexToHsl(theme.secondaryColor));
  root.style.setProperty("--secondary-foreground", pickForegroundHsl(theme.secondaryColor));
  root.style.setProperty("--accent", hexToHsl(theme.accentColor));
  root.style.setProperty("--accent-foreground", pickForegroundHsl(theme.accentColor));
  root.style.setProperty("--ring", hexToHsl(theme.primaryColor));
  root.style.setProperty("--hero-primary-rgb", hexToRgbTriplet(theme.primaryColor));
  root.style.setProperty("--hero-accent-rgb", hexToRgbTriplet(theme.accentColor));
  root.style.setProperty("--font-sans-family", fonts.sans);
  root.style.setProperty("--font-display-family", fonts.display);
  root.style.setProperty("--radius", theme.density === "compact" ? "0.85rem" : "1rem");
  root.style.setProperty("--density-scale", theme.density === "compact" ? "0.95" : "1");
}

interface TenantConfigProviderProps {
  children: ReactNode;
}

export function TenantConfigProvider({ children }: TenantConfigProviderProps) {
  const { status: authStatus, isAuthenticated, accessToken } = useAuth();
  const [status, setStatus] = useState<TenantConfigStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantConfigurationBootstrapResponse["tenant"] | null>(null);
  const [settings, setSettings] = useState<TenantCoreSettings>(defaultTenantCoreSettings);
  const [theme, setTheme] = useState<TenantThemeSettings>(defaultTenantThemeSettings);
  const [modules, setModules] = useState<TenantModuleState[]>(defaultModules);
  const [terminology, setTerminology] = useState<TenantTerminologyEntry[]>(
    defaultTenantTerminologyEntries
  );
  const [summary, setSummary] = useState<TenantConfigurationSummary>(defaultSummary);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  async function loadTenantConfig(activeAccessToken: string) {
    const response = await apiRequest<TenantConfigurationBootstrapResponse>("/tenant-config", {
      method: "GET",
      accessToken: activeAccessToken
    });

    setTenant(response.tenant);
    setSettings(response.settings);
    setTheme(response.theme);
    setModules(response.modules);
    setTerminology(response.terminology);
    setSummary(response.summary);
  }

  async function reload() {
    if (!accessToken) {
      return;
    }

    setErrorMessage(null);
    setStatus("loading");

    try {
      await loadTenantConfig(accessToken);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
        return;
      }

      if (error instanceof Error) {
        setErrorMessage(error.message);
        return;
      }

      setErrorMessage("Tenant configuration could not be loaded.");
    }
  }

  useEffect(() => {
    if (authStatus === "loading") {
      setStatus("loading");
      return;
    }

    if (!isAuthenticated || !accessToken) {
      setStatus("idle");
      setErrorMessage(null);
      setTenant(null);
      setSettings(defaultTenantCoreSettings);
      setTheme(defaultTenantThemeSettings);
      setModules(defaultModules);
      setTerminology(defaultTenantTerminologyEntries);
      setSummary(defaultSummary);
      return;
    }

    void reload();
  }, [authStatus, isAuthenticated, accessToken]);

  const moduleMap = useMemo(
    () => new Map(modules.map((module) => [module.moduleKey, module])),
    [modules]
  );
  const terminologyMap = useMemo(
    () => new Map(terminology.map((entry) => [entry.moduleKey, entry])),
    [terminology]
  );

  function isModuleEnabled(moduleKey: PermissionModuleKey) {
    return moduleMap.get(moduleKey)?.enabled ?? true;
  }

  function getModuleLabel(moduleKey: PermissionModuleKey, form: "singular" | "plural" = "plural") {
    const entry = terminologyMap.get(moduleKey);

    if (entry) {
      return form === "singular" ? entry.singular : entry.plural;
    }

    return permissionModuleLabels[moduleKey];
  }

  return (
    <TenantConfigContext.Provider
      value={{
        status,
        errorMessage,
        tenant,
        settings,
        theme,
        modules,
        terminology,
        summary,
        reload,
        isModuleEnabled,
        getModuleLabel
      }}
    >
      {children}
    </TenantConfigContext.Provider>
  );
}

export function useTenantConfig() {
  const context = useContext(TenantConfigContext);

  if (!context) {
    throw new Error("useTenantConfig must be used within TenantConfigProvider.");
  }

  return context;
}
