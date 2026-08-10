import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  apiFetch,
  loginRequest,
  registerRequest,
  logoutRequest,
  storeTokens,
  clearTokens,
  getStoredTokens,
  setSessionExpiredHandler,
  ApiError,
  AuthUser,
} from "@/api/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A refresh failure anywhere in the app (not just from a call this
  // provider made directly) means the session is over — apiFetch calls
  // this to drop the app back to the login screen from wherever it is.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus("unauthenticated");
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // On launch: no stored tokens at all means don't bother with a network
  // round trip. Otherwise ask for the current user — apiFetch's own
  // 401-then-refresh handling covers both "access token still valid" and
  // "access token expired, refresh token might not be" in one path.
  useEffect(() => {
    (async () => {
      const { accessToken, refreshToken } = await getStoredTokens();
      if (!accessToken && !refreshToken) {
        setStatus("unauthenticated");
        return;
      }
      try {
        const me = await apiFetch<AuthUser>("/users/me");
        setUser(me);
        setStatus("authenticated");
      } catch {
        setStatus("unauthenticated");
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await loginRequest(email, password);
      await storeTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      setStatus("authenticated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      throw err;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    try {
      const result = await registerRequest(email, password, name);
      await storeTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      setStatus("authenticated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    const { refreshToken } = await getStoredTokens();
    if (refreshToken) {
      // Best-effort server-side revocation — the tokens are wiped locally
      // either way below, which is what actually logs this device out.
      logoutRequest(refreshToken).catch(() => {});
    }
    await clearTokens();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ status, user, error, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
