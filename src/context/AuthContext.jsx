import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { getAppBaseUrl, getPasswordRecoveryRedirectUrl } from "../utils/appUrl";

const AuthContext = createContext(null);
const DEBUG_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEBUG_AUTH === "true";

/*This function checks whether the current URL is part of a password recovery flow.*/
function getRecoveryTypeFromUrl() {
  if (typeof window === "undefined") return false;

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
}

/*This function provides auth state and auth actions to the rest of the application.*/
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [lastAuthEvent, setLastAuthEvent] = useState(null);

  useEffect(() => {
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

    /*This function loads the current session when the auth provider starts.*/
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
    /*This function loads the signed-in user's lightweight profile for shared UI state.*/
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

  /*This function creates a new account with the supplied email, password, and options.*/
  const signUp = async (email, password, options = {}) => {
    return supabase.auth.signUp({ email, password, options });
  };

  /*This function signs a user in with an email address and password.*/
  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  /*This function starts the Google sign-in flow and applies the correct redirect URL.*/
  const signInWithGoogle = async ({ redirectTo } = {}) => {
    const resolvedRedirect = redirectTo ?? getAppBaseUrl();

    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: resolvedRedirect },
    });
  };

  /*This function sends a password reset email with the correct recovery redirect.*/
  const resetPassword = async (email, { redirectTo } = {}) => {
    const resolvedRedirect = redirectTo ?? getPasswordRecoveryRedirectUrl();

    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resolvedRedirect,
    });
  };

  /*This function clears the password recovery state after the flow is finished.*/
  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  /*This function signs the user out and resets recovery state in the client.*/
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

/*This function returns the auth context and throws if it is used outside the provider.*/
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
