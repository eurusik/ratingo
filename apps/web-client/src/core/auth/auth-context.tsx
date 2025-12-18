/**
 * Auth context and provider for managing authentication state.
 */

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, type MeDto, type LoginDto, type RegisterDto } from '../api/auth';
import { tokenStorage } from './token-storage';
import { setTokenGetter } from '../api/client';
import { queryKeys } from '../query/keys';

/** Auth context state. */
interface AuthState {
  /** Current authenticated user. */
  user: MeDto | null;
  /** Whether auth is being initialized. */
  isLoading: boolean;
  /** Whether user is authenticated. */
  isAuthenticated: boolean;
}

/** Auth context actions. */
interface AuthActions {
  /** Logs in with email/password. */
  login: (data: LoginDto) => Promise<void>;
  /** Registers a new user. */
  register: (data: RegisterDto) => Promise<void>;
  /** Logs out current user. */
  logout: () => Promise<void>;
  /** Refreshes current user data. */
  refreshUser: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/** Auth provider component. */
export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<MeDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initialize token getter for API client
  useEffect(() => {
    setTokenGetter(() => tokenStorage.getAccessToken());
  }, []);

  // Fetch current user on mount
  const fetchUser = useCallback(async () => {
    if (!tokenStorage.hasTokens()) {
      setIsLoading(false);
      return;
    }

    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      // Token invalid or expired, try refresh
      const refreshToken = tokenStorage.getRefreshToken();
      if (refreshToken) {
        try {
          const tokens = await authApi.refresh({ refreshToken });
          tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
          const me = await authApi.me();
          setUser(me);
        } catch {
          // Refresh failed, clear tokens
          tokenStorage.clearTokens();
          setUser(null);
        }
      } else {
        tokenStorage.clearTokens();
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Listen for unauthorized events from API client
  useEffect(() => {
    const handleUnauthorized = () => {
      tokenStorage.clearTokens();
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (data: LoginDto) => {
    const tokens = await authApi.login(data);
    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    const me = await authApi.me();
    setUser(me);
  }, []);

  const register = useCallback(async (data: RegisterDto) => {
    const tokens = await authApi.register(data);
    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    const me = await authApi.me();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      tokenStorage.clearTokens();
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    if (!tokenStorage.hasTokens()) return;
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      // Ignore refresh errors
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, isAuthenticated, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook to access auth context. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
