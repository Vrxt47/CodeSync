"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { apiClient, setAccessToken as setGlobalAccessToken } from "../lib/apiClient";
import type { User, RegisterInput, LoginInput, ApiResponse, AuthResponseData } from "../types/auth";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  register: (data: RegisterInput) => Promise<void>;
  login: (data: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setLocalAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const updateTokensAndUser = useCallback((newAccessToken: string | null, newUser: User | null) => {
    setLocalAccessToken(newAccessToken);
    setGlobalAccessToken(newAccessToken);
    setUser(newUser);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiClient<ApiResponse<AuthResponseData>>("/api/auth/refresh", {
        method: "POST",
        skipAuthRefresh: true,
      });

      if (response.success && response.data?.accessToken && response.data?.user) {
        updateTokensAndUser(response.data.accessToken, response.data.user);
        return true;
      }

      updateTokensAndUser(null, null);
      return false;
    } catch {
      updateTokensAndUser(null, null);
      return false;
    }
  }, [updateTokensAndUser]);

  // Restore session on initial load using the HttpOnly refresh token cookie
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        await refreshSession();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [refreshSession]);

  const register = useCallback(
    async (data: RegisterInput): Promise<void> => {
      const res = await apiClient<ApiResponse<AuthResponseData>>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
        skipAuthRefresh: true,
      });

      if (res.success && res.data) {
        updateTokensAndUser(res.data.accessToken, res.data.user);
      }
    },
    [updateTokensAndUser]
  );

  const login = useCallback(
    async (data: LoginInput): Promise<void> => {
      const res = await apiClient<ApiResponse<AuthResponseData>>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
        skipAuthRefresh: true,
      });

      if (res.success && res.data) {
        updateTokensAndUser(res.data.accessToken, res.data.user);
      }
    },
    [updateTokensAndUser]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient<ApiResponse<void>>("/api/auth/logout", {
        method: "POST",
        skipAuthRefresh: true,
      });
    } catch (err) {
      console.warn("Logout API call error:", err);
    } finally {
      updateTokensAndUser(null, null);
    }
  }, [updateTokensAndUser]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isLoading,
      isAuthenticated: !!user,
      register,
      login,
      logout,
      refreshSession,
    }),
    [user, accessToken, isLoading, register, login, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
