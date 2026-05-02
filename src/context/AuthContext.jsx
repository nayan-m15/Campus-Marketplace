// Main structure for the auth context feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { getAppBaseUrl } from "../utils/appUrl";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user ?? null);

      if (typeof window !== "undefined") {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        setIsPasswordRecovery(hash.get("type") === "recovery");
      }

      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {
        const currentUser = session?.user ?? null;
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

    return () => subscription.unsubscribe();
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
