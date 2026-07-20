"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { migrateLegacyPersonalStateToSupabase } from "@/lib/personalRecipeState";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  sendMagicLink: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function checkAdmin(user: User | null) {
  if (!user) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data, error } = await supabase.rpc("is_recipe_admin");
  if (error) return false;
  return data === true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const refreshUser = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    const admin = await checkAdmin(nextUser);
    setIsAdmin(admin);

    if (admin) {
      try {
        await migrateLegacyPersonalStateToSupabase();
      } catch {
        // The legacy browser state remains untouched and can be retried later.
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) void refreshUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) void refreshUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshUser]);

  const sendMagicLink = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase environment variables are missing.");
    }

    const emailRedirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: false,
      },
    });

    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase environment variables are missing.");
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin,
      sendMagicLink,
      signInWithGoogle,
      signOut,
    }),
    [user, loading, isAdmin, sendMagicLink, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
