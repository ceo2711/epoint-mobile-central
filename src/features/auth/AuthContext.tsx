import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "expo-router";

import { api, setActiveMerchantIdProvider } from "@/lib/api";
import {
  getDefaultAppPath,
  mustForcePasswordChange,
} from "@/lib/appNavigation";
import {
  persistLoginSession,
  restoreSession,
  revokeSession,
} from "@/lib/auth-session";
import {
  clearToken,
  clearTwoFactorTempToken,
  getTwoFactorTempToken,
  onAccessTokenRefreshed,
  setTwoFactorTempToken,
} from "@/lib/auth-storage";
import { setUnauthorizedHandler } from "@/lib/auth-unauthorized";
import type { LoginResponse, User } from "@/types/api";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ requiresTwoFactor: boolean; userName?: string }>;
  completeTwoFactorLogin: (code: string) => Promise<void>;
  cancelTwoFactorLogin: () => void;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const session = await restoreSession();
    if (!session) {
      setUser(null);
      setTokenState(null);
      return null;
    }
    setUser(session.user);
    setTokenState(session.token);
    return session.user;
  }, []);

  useEffect(() => {
    restoreSession()
      .then((session) => {
        if (!session) return;
        setUser(session.user);
        setTokenState(session.token);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearToken();
      setUser(null);
      setTokenState(null);
      router.replace("/(auth)/login");
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  useEffect(() => {
    return onAccessTokenRefreshed((nextToken) => {
      setTokenState(nextToken);
    });
  }, []);

  useEffect(() => {
    setActiveMerchantIdProvider(() => user?.active_merchant_id ?? null);
  }, [user?.active_merchant_id]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.post<LoginResponse>("/auth/login", {
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (response.requires_2fa && response.temp_token) {
        await setTwoFactorTempToken(response.temp_token);
        const userName = response.user
          ? `${response.user.first_name} ${response.user.last_name}`.trim()
          : undefined;
        return { requiresTwoFactor: true, userName };
      }

      if (!response.access_token || !response.refresh_token || !response.user) {
        throw new Error("Respuesta de login inválida");
      }

      await persistLoginSession(response.access_token, response.refresh_token);
      setTokenState(response.access_token);
      setUser(response.user);
      if (response.must_change_password) {
        router.replace("/(auth)/change-password");
      } else {
        router.replace(getDefaultAppPath(response.user.role.code) as never);
      }
      return { requiresTwoFactor: false };
    },
    [router],
  );

  const cancelTwoFactorLogin = useCallback(() => {
    void clearTwoFactorTempToken();
  }, []);

  const completeTwoFactorLogin = useCallback(
    async (code: string) => {
      const tempToken = await getTwoFactorTempToken();
      if (!tempToken) {
        router.replace("/(auth)/login");
        return;
      }

      const response = await api.post<LoginResponse>("/auth/2fa/verify", {
        temp_token: tempToken,
        code,
      });

      if (!response.access_token || !response.refresh_token || !response.user) {
        throw new Error("Respuesta 2FA inválida");
      }

      await clearTwoFactorTempToken();
      await persistLoginSession(response.access_token, response.refresh_token);
      setTokenState(response.access_token);
      setUser(response.user);

      if (response.must_change_password) {
        router.replace("/(auth)/change-password");
      } else {
        router.replace(getDefaultAppPath(response.user.role.code) as never);
      }
    },
    [router],
  );

  const logout = useCallback(() => {
    void revokeSession();
    void clearToken();
    void clearTwoFactorTempToken();
    setUser(null);
    setTokenState(null);
    router.replace("/(auth)/login");
  }, [router]);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.role.code === "ADMIN") return true;
      return user.permissions?.includes(permission) ?? false;
    },
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      completeTwoFactorLogin,
      cancelTwoFactorLogin,
      logout,
      refreshUser,
      hasPermission,
    }),
    [
      user,
      token,
      isLoading,
      login,
      completeTwoFactorLogin,
      cancelTwoFactorLogin,
      logout,
      refreshUser,
      hasPermission,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

export { mustForcePasswordChange };
