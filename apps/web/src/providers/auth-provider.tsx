import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
  AuthSessionSummary,
  AuthUserSummary,
  AuthResponse,
  CurrentUserResponse,
  LoginRequestBody
} from "@crm/types";
import { apiRequest } from "@/lib/api-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUserSummary | null;
  session: AuthSessionSummary | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequestBody) => Promise<void>;
  logout: () => Promise<void>;
  reloadCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadCurrentUser(accessToken: string) {
  return apiRequest<CurrentUserResponse>("/auth/me", {
    method: "GET",
    accessToken
  });
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUserSummary | null>(null);
  const [session, setSession] = useState<AuthSessionSummary | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  async function applyAuthenticatedState(authResponse: AuthResponse) {
    setAccessToken(authResponse.tokens.accessToken);

    try {
      const currentUserResponse = await loadCurrentUser(authResponse.tokens.accessToken);
      setUser(currentUserResponse.user);
      setSession(currentUserResponse.session);
    } catch {
      setUser(authResponse.user);
      setSession(authResponse.session);
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
      const authResponse = await apiRequest<AuthResponse>("/auth/refresh", {
        method: "POST",
        body: {}
      });

      await applyAuthenticatedState(authResponse);
    } catch {
      clearAuthState();
    }
  }

  useEffect(() => {
    void bootstrapSession();
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

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        session,
        accessToken,
        isAuthenticated: status === "authenticated",
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
