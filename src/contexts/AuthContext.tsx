import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthState {
  /** Current authenticated user, or null if signed out */
  user: User | null;
  /** Current Supabase session, or null */
  session: Session | null;
  /** Whether the auth state is still being initialized */
  isLoading: boolean;
  /** Whether a Supabase client is configured */
  isConfigured: boolean;
  /** Sign in with Google OAuth */
  signInWithGoogle: () => Promise<void>;
  /** Sign out and clear session */
  signOut: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Synchronise Sentry's user identity with the current Supabase session.
 *
 * Called whenever auth state changes so every subsequent Sentry event is
 * tagged with the correct user id and email.
 */
function syncSentryUser(session: Session | null): void {
  if (session?.user) {
    Sentry.setUser({
      id: session.user.id,
      email: session.user.email,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Auth context provider — wraps the app and manages Supabase auth state.
 *
 * Exposes user, session, isLoading, and sign-in/out methods via `useAuth()`.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isConfigured = supabase !== null;

  // Initialize auth state on mount
  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Guard against state updates after unmount
    let cancelled = false;

    // Wrap getSession() in an async IIFE with try/catch/finally so that:
    // - a rejection never produces an unhandled promise rejection
    // - isLoading is guaranteed to flip to false even on failure
    // - state is never set after the component unmounts
    void (async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!cancelled) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          syncSentryUser(initialSession);
        }
      } catch (error: unknown) {
        console.error('[Auth] Failed to retrieve initial session:', error);
        Sentry.captureException(error, {
          tags: { 'auth.action': 'getSession' },
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!cancelled) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);
        syncSentryUser(newSession);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Auth actions
  // -----------------------------------------------------------------------

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      console.error('[Auth] Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
    } catch (error: unknown) {
      console.error('[Auth] Google Sign-In failed:', error);
      Sentry.captureException(error, {
        tags: { 'auth.action': 'signInWithGoogle' },
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (error: unknown) {
      console.error('[Auth] Sign-out failed:', error);
      Sentry.captureException(error, {
        tags: { 'auth.action': 'signOut' },
      });
    }
  }, []);

  // -----------------------------------------------------------------------
  // Context value (memoized)
  // -----------------------------------------------------------------------

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      isLoading,
      isConfigured,
      signInWithGoogle,
      signOut,
    }),
    [user, session, isLoading, isConfigured, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Consume the AuthContext. Must be used within an <AuthProvider>.
 *
 * @throws If called outside of an AuthProvider.
 */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used within an <AuthProvider>.');
  }
  return context;
}
