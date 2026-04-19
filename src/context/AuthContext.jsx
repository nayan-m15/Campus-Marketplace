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

  useEffect(() => {
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user ?? null);
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // Ensure profile exists on login
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

  // A focused piece of component behavior is handled here.
  // Keeping it separate makes the main flow less crowded.
  const signUp = async (email, password, options = {}) => {
    return supabase.auth.signUp({ email, password, options });
  };

  // A focused piece of component behavior is handled here.
  // Keeping it separate makes the main flow less crowded.
  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  // A focused piece of component behavior is handled here.
  // Keeping it separate makes the main flow less crowded.
  const signInWithGoogle = async ({ redirectTo } = {}) => {
    const resolvedRedirect = redirectTo ?? getAppBaseUrl();

    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: resolvedRedirect },
    });
  };

  // A focused piece of component behavior is handled here.
  // Keeping it separate makes the main flow less crowded.
  const signOut = async () => {
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
