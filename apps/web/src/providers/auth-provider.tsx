import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
  AuthSessionSummary,
  AuthUserSummary,
  AuthResponse,
  CurrentUserResponse,
  LoginRequestBody
} from "@crm/types";
import { ApiClientError, apiRequest } from "@/lib/api-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUserSummary | null;
  session: AuthSessionSummary | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  hasAllPermissions: (permissionCodes: string[]) => boolean;
  login: (credentials: LoginRequestBody) => Promise<void>;
  logout: () => Promise<void>;
  reloadCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
let bootstrapSessionRequest: Promise<AuthResponse | null> | null = null;

async function loadCurrentUser(accessToken: string) {
  return apiRequest<CurrentUserResponse>("/auth/me", {
    method: "GET",
    accessToken
  });
}

async function requestBootstrapSession() {
  if (!bootstrapSessionRequest) {
    bootstrapSessionRequest = apiRequest<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: {}
    })
      .catch((error) => {
        if (error instanceof ApiClientError && error.statusCode === 401) {
          return null;
        }

        throw error;
      })
      .finally(() => {
        bootstrapSessionRequest = null;
      });
  }

  return bootstrapSessionRequest;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUserSummary | null>(null);
  const [session, setSession] = useState<AuthSessionSummary | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  async function applyAuthenticatedState(
    authResponse: AuthResponse,
    isCancelled: (() => boolean) | null = null
  ) {
    if (isCancelled?.()) {
      return;
    }

    setAccessToken(authResponse.tokens.accessToken);

    try {
      const currentUserResponse = await loadCurrentUser(authResponse.tokens.accessToken);

      if (isCancelled?.()) {
        return;
      }

      setUser(currentUserResponse.user);
      setSession(currentUserResponse.session);
    } catch {
      if (isCancelled?.()) {
        return;
      }

      setUser(authResponse.user);
      setSession(authResponse.session);
    }

    if (isCancelled?.()) {
      return;
    }

    setStatus("authenticated");
  }

  function clearAuthState() {
    setStatus("unauthenticated");
    setUser(null);
    setSession(null);
    setAccessToken(null);
  }

  async function bootstrapSession() {
    try {
      const authResponse = await requestBootstrapSession();

      if (!authResponse) {
        clearAuthState();
        return;
      }

      await applyAuthenticatedState(authResponse);
    } catch {
      clearAuthState();
    }
  }

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const authResponse = await requestBootstrapSession();

        if (isCancelled) {
          return;
        }

        if (!authResponse) {
          clearAuthState();
          return;
        }

        await applyAuthenticatedState(authResponse, () => isCancelled);
      } catch {
        if (!isCancelled) {
          clearAuthState();
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function login(credentials: LoginRequestBody) {
    const authResponse = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: credentials
    });

    await applyAuthenticatedState(authResponse);
  }

  async function logout() {
    try {
      await apiRequest<{ success: true }>("/auth/logout", {
        method: "POST",
        accessToken
      });
    } catch {
      // Clear local auth state even if the server session is already gone.
    } finally {
      clearAuthState();
    }
  }

  async function reloadCurrentUser() {
    if (!accessToken) {
      setStatus("loading");
      await bootstrapSession();
      return;
    }

    const currentUserResponse = await loadCurrentUser(accessToken);
    setUser(currentUserResponse.user);
    setSession(currentUserResponse.session);
    setStatus("authenticated");
  }

  function hasPermission(permissionCode: string) {
    return (user?.permissionCodes ?? []).includes(permissionCode);
  }

  function hasAnyPermission(permissionCodes: string[]) {
    return permissionCodes.some((permissionCode) => hasPermission(permissionCode));
  }

  function hasAllPermissions(permissionCodes: string[]) {
    return permissionCodes.every((permissionCode) => hasPermission(permissionCode));
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        session,
        accessToken,
        isAuthenticated: status === "authenticated",
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        login,
        logout,
        reloadCurrentUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
