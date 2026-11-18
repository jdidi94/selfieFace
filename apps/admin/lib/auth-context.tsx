'use client';

import { authSessionRequest } from './auth-session-request';

import { UserType, type AuthUser } from '@lumea/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from 'react';

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRevision = useRef(0);

  const applySession = useCallback((session: { accessToken: string; user: AuthUser }) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);

  const refresh = useCallback(async () => {
    const revision = sessionRevision.current;
    const res = await authSessionRequest('/api/auth/refresh', { method: 'POST' });
    if (revision !== sessionRevision.current) return;
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) return;
      setAccessToken(null);
      setUser(null);
      return;
    }
    const data = (await res.json()) as { accessToken: string; user: AuthUser };
    if (revision !== sessionRevision.current) return;
    if (data.user.type !== UserType.ADMIN) {
      await authSessionRequest('/api/auth/logout', { method: 'POST' });
      setAccessToken(null);
      setUser(null);
      return;
    }
    applySession(data);
  }, [applySession]);

  useEffect(() => {
    void refresh().catch(() => {}).finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      sessionRevision.current += 1;
      const res = await authSessionRequest('/api/auth/login', {
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

  const logout = useCallback(async () => {
    sessionRevision.current += 1;
    await authSessionRequest('/api/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, accessToken, loading, login, logout }),
    [user, accessToken, loading, login, logout],
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
