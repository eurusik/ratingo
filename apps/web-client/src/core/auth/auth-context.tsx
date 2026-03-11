/**
 * Authentication Context Module
 *
 * Provides React context for managing authentication state across the application.
 * Handles login, logout, registration, token refresh, and cross-tab synchronization.
 *
 * @module core/auth/auth-context
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
import { authApi, type MeDto, type LoginDto, type RegisterDto } from '../api/auth.client';
import { tokenStorage } from './token-storage';
import { setTokenGetter } from '../api/client';
import { ApiError } from '../api/error';
import { toast } from 'sonner';
import { scheduleProactiveRefresh, cancelProactiveRefresh } from './proactive-refresh';
import {
  initCrossTabSync,
  broadcastLogout,
  destroyCrossTabSync,
} from './cross-tab-sync';

/**
 * Authentication state interface.
 */
interface AuthState {
  /** Current authenticated user or null if not authenticated. */
  user: MeDto | null;
  /** True during initial authentication check on mount. */
  isLoading: boolean;
  /** True if user is authenticated (has valid session). */
  isAuthenticated: boolean;
  /** True if authenticated user has admin role. */
  isAdmin: boolean;
}

/**
 * Authentication actions interface.
 */
interface AuthActions {
  /**
   * Authenticates user with email and password.
   *
   * @param data - Login credentials
   * @throws {ApiError} When credentials are invalid
   */
  login: (data: LoginDto) => Promise<void>;

  /**
   * Registers new user account.
   *
   * @param data - Registration data
   * @throws {ApiError} When email already exists or validation fails
   */
  register: (data: RegisterDto) => Promise<void>;

  /**
   * Logs out current user.
   * Clears tokens, cancels proactive refresh, and notifies other tabs.
   */
  logout: () => Promise<void>;

  /**
   * Refreshes current user data from API.
   * Useful after profile updates.
   */
  refreshUser: () => Promise<void>;
}

/** Combined auth context value type. */
type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication provider component.
 *
 * Wraps application to provide authentication state and actions.
 * Handles:
 * - Initial auth state restoration from tokens
 * - Proactive token refresh scheduling
 * - Cross-tab synchronization via BroadcastChannel
 * - Unauthorized event handling from API client
 *
 * @example
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<MeDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';

  // Initialize token getter for API client
  useEffect(() => {
    setTokenGetter(() => tokenStorage.getAccessToken());
  }, []);

  // Initialize cross-tab sync
  useEffect(() => {
    initCrossTabSync({
      onTokensUpdated: () => {
        // Another tab refreshed tokens, schedule our proactive refresh
        scheduleProactiveRefresh();
      },
      onLogout: () => {
        // Another tab logged out
        cancelProactiveRefresh();
        setUser(null);
        queryClient.clear();
      },
    });

    return () => {
      destroyCrossTabSync();
    };
  }, [queryClient]);

  /**
   * Fetches current user and restores auth state.
   * Called on mount and after OAuth callback.
   */
  const fetchUser = useCallback(async () => {
    if (!tokenStorage.hasTokens()) {
      setIsLoading(false);
      return;
    }

    try {
      // The afterResponse hook in client.ts transparently handles
      // 401 → refresh → retry. If me() throws, refresh already failed.
      const me = await authApi.me();
      setUser(me);
      scheduleProactiveRefresh();
    } catch (error) {
      // Definitive auth failures (ApiError 401): client.ts already cleared
      // tokens before throwing; reflect that in React state.
      // Transient failures (network down, 5xx — including ApiError 5xx):
      // tokens are still in storage, so keep the user logged in.
      const isDefinitiveAuthFailure =
        error instanceof ApiError && error.statusCode === 401;
      if (isDefinitiveAuthFailure || !tokenStorage.hasTokens()) {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Handle unauthorized events from API client (401 after failed refresh)
  useEffect(() => {
    const handleUnauthorized = () => {
      cancelProactiveRefresh();
      // tokens were already cleared by client.ts before this event was fired
      setUser((prev) => {
        if (prev !== null) {
          // User was actively signed in — tell them their session expired
          toast.error('Сесія закінчилась. Увійдіть знову.');
        }
        return null;
      });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Handle tokens-updated events (e.g., from OAuth callback)
  useEffect(() => {
    const handleTokensUpdated = () => {
      fetchUser();
    };

    window.addEventListener('auth:tokens-updated', handleTokensUpdated);
    return () => window.removeEventListener('auth:tokens-updated', handleTokensUpdated);
  }, [fetchUser]);

  const login = useCallback(async (data: LoginDto) => {
    const tokens = await authApi.login(data);
    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    const me = await authApi.me();
    setUser(me);
    scheduleProactiveRefresh();
  }, []);

  const register = useCallback(async (data: RegisterDto) => {
    const tokens = await authApi.register(data);
    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    const me = await authApi.me();
    setUser(me);
    scheduleProactiveRefresh();
  }, []);

  const logout = useCallback(async () => {
    cancelProactiveRefresh();
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    } finally {
      tokenStorage.clearTokens();
      setUser(null);
      queryClient.clear();
      broadcastLogout();
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
      isAdmin,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, isAuthenticated, isAdmin, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context.
 *
 * @returns Auth state and actions
 * @throws {Error} When used outside AuthProvider
 *
 * @example
 * const { user, isAuthenticated, login, logout } = useAuth();
 *
 * if (isAuthenticated) {
 *   console.log(`Logged in as ${user.email}`);
 * }
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
