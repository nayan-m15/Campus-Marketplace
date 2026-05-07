// Main structure for the auth context feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { getAppBaseUrl } from "../utils/appUrl";

const AuthContext = createContext(null);

function getRecoveryTypeFromUrl() {
  if (typeof window === "undefined") return false;

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
}

async function isRecoverySession() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) return false;
  
  // Check if this is a recovery session by looking at the session's user metadata
  // Recovery sessions have a specific structure, or we can check for the recovery token
  const hasRecoveryType = getRecoveryTypeFromUrl();
  return hasRecoveryType;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // Set up the auth state listener FIRST, before any async operations
    // This ensures PASSWORD_RECOVERY events are caught immediately
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // PASSWORD_RECOVERY is the event that fires when recovery link is clicked
        if (event === "PASSWORD_RECOVERY") {
          setIsPasswordRecovery(true);
        } else if (event === "SIGNED_OUT") {
          setIsPasswordRecovery(false);
        } else if (event === "SIGNED_IN" && currentUser) {
          // For regular sign-in, check URL as fallback
          const isRecovery = getRecoveryTypeFromUrl();
          setIsPasswordRecovery(isRecovery);

          // Profile upsert
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

    // Now initialize the session
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data?.session?.user ?? null;
      setUser(currentUser);
      
      // Check URL for recovery as a fallback (in case event wasn't caught)
      const isRecovery = getRecoveryTypeFromUrl();
      if (isRecovery) {
        setIsPasswordRecovery(true);
      }

      setLoading(false);
    };

    initAuth();

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setIsPasswordRecovery(getRecoveryTypeFromUrl());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
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
    return supabase.auth.signUp({ email, password, options });
  };

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signInWithGoogle = async ({ redirectTo } = {}) => {
    const resolvedRedirect = redirectTo ?? getAppBaseUrl();

    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: resolvedRedirect },
    });
  };

  const resetPassword = async (email, { redirectTo } = {}) => {
    const resolvedRedirect = redirectTo ?? getAppBaseUrl();

    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resolvedRedirect,
    });
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  const signOut = async () => {
    setIsPasswordRecovery(false);
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
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
