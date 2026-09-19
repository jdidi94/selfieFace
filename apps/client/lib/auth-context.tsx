'use client';

import type { AuthUser } from '@lumea/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((session: { accessToken: string; user: AuthUser }) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!res.ok) {
      setAccessToken(null);
      setUser(null);
      return;
    }
    const data = (await res.json()) as { accessToken: string; user: AuthUser };
    applySession(data);
  }, [applySession]);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        accessToken?: string;
        user?: AuthUser;
        message?: string;
      };
      if (!res.ok || !data.accessToken || !data.user) {
        throw new Error(data.message ?? 'Login failed');
      }
      applySession({ accessToken: data.accessToken, user: data.user });
    },
    [applySession],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => ({}))) as {
        accessToken?: string;
        user?: AuthUser;
        message?: string;
      };
      if (!res.ok || !data.accessToken || !data.user) {
        throw new Error(data.message ?? 'Registration failed');
      }
      applySession({ accessToken: data.accessToken, user: data.user });
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      login,
      register,
      logout,
      refreshSession: refresh,
    }),
    [user, accessToken, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
