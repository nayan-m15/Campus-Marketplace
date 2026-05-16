// Main structure for the auth context feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../supabaseClient";
import { getAppBaseUrl, getPasswordRecoveryRedirectUrl } from "../utils/appUrl";

const AuthContext = createContext(null);
const DEBUG_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEBUG_AUTH === "true";

function getRecoveryTypeFromUrl() {
  if (typeof window === "undefined") return false;

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [lastAuthEvent, setLastAuthEvent] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      const currentUser = session?.user ?? null;

      if (DEBUG_AUTH) {
        console.debug("[Auth] onAuthStateChange", {
          event,
          userId: currentUser?.id ?? null,
          hasSession: Boolean(session),
        });
      }

      setLastAuthEvent(event);
      setUser(currentUser);

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      } else if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
      }

      if (event === "SIGNED_IN" && currentUser) {
        supabase
          .from("profiles")
          .upsert(
            {
              id: currentUser.id,
              email: currentUser.email,
            },
            { onConflict: "id" }
          )
          .then(({ error }) => {
            if (error) console.error("Profile upsert error:", error.message);
          });
      }
    });

    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session bootstrap error:", error.message);
        }

        if (!isMounted) return;

        const currentUser = data?.session?.user ?? null;

        if (DEBUG_AUTH) {
          console.debug("[Auth] getSession resolved", {
            userId: currentUser?.id ?? null,
            hasSession: Boolean(data?.session),
          });
        }

        setUser(currentUser);
        setIsPasswordRecovery((current) => current || getRecoveryTypeFromUrl());
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setProfile(null);
      return;
    }

    const fetchProfile = async () => {
      if (!user?.id) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, email, is_verified, verified_university")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Profile fetch error:", error.message);
        setProfile(null);
        return;
      }

      setProfile(data);
    };

    fetchProfile();
  }, [user]);

  const signUp = async (email, password, options = {}) => {
    if (!isSupabaseConfigured) return { error: new Error("Supabase is not configured.") };
    return supabase.auth.signUp({ email, password, options });
  };

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) return { error: new Error("Supabase is not configured.") };
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signInWithGoogle = async ({ redirectTo } = {}) => {
    if (!isSupabaseConfigured) return { error: new Error("Supabase is not configured.") };
    const resolvedRedirect = redirectTo ?? getAppBaseUrl();

    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: resolvedRedirect },
    });
  };

  const resetPassword = async (email, { redirectTo } = {}) => {
    if (!isSupabaseConfigured) return { error: new Error("Supabase is not configured.") };
    const resolvedRedirect = redirectTo ?? getPasswordRecoveryRedirectUrl();

    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resolvedRedirect,
    });
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  const signOut = async () => {
    setIsPasswordRecovery(false);
    if (!isSupabaseConfigured) return { error: new Error("Supabase is not configured.") };
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        lastAuthEvent,
        signUp,
        signIn,
        signInWithGoogle,
        resetPassword,
        isPasswordRecovery,
        clearPasswordRecovery,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
