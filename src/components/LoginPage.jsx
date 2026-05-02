// Main structure for the login page feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/Auth.css";

// Component entry point for this part of the interface.
// Rendering and feature-specific behavior are coordinated here.
export default function LoginPage({ onNavigate }) {
  const { signIn, signInWithGoogle, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error.message);
  }

  async function handleGoogle() {
    setError("");
    setInfo("");
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) setError(error.message);
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email.trim()) {
      setError("Enter your email address to receive a reset link.");
      return;
    }

    setResetLoading(true);
    const { error } = await resetPassword(email.trim());
    setResetLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInfo("Password reset link sent. Check your inbox and spam folder.");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <button
          className="auth-back-btn"
          type="button"
          onClick={() => onNavigate("home")}
        >
          {"<-"}
        </button>

        <div className="auth-logo">
          <span className="auth-logo__icon">
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="CAMPUSXCHANGE Logo" className="navbar__logo-img" />
          </span>
          <span className="auth-logo__text">CAMPUSXCHANGE</span>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">
          {showForgotPassword
            ? "Enter your email and we will send you a password reset link"
            : "Sign in to your student marketplace account"}
        </p>

        {!showForgotPassword && (
          <>
            <button
              className="auth-google-btn"
              onClick={handleGoogle}
              disabled={googleLoading}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {googleLoading ? "Redirecting..." : "Continue with Google"}
            </button>

            <div className="auth-divider">
              <span>or sign in with email</span>
            </div>
          </>
        )}

        {error && <p className="auth-error" role="alert">{error}</p>}
        {info && <p className="auth-success-message">{info}</p>}

        <form
          onSubmit={showForgotPassword ? handleForgotPassword : handleSubmit}
          className="auth-form"
          noValidate
        >
          <div className="auth-field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@university.ac.za"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {!showForgotPassword && (
            <>
              <div className="auth-field">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="........"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="button"
                className="auth-inline-link"
                onClick={() => {
                  setError("");
                  setInfo("");
                  setShowForgotPassword(true);
                }}
              >
                Forgot your password?
              </button>
            </>
          )}

          <button
            type="submit"
            className="btn-primary auth-submit"
            disabled={showForgotPassword ? resetLoading : loading}
          >
            {showForgotPassword
              ? (resetLoading ? "Sending reset link..." : "Send reset link")
              : (loading ? "Signing in..." : "Sign In ->")}
          </button>
        </form>

        {showForgotPassword && (
          <button
            type="button"
            className="auth-inline-link auth-inline-link--center"
            onClick={() => {
              setError("");
              setInfo("");
              setShowForgotPassword(false);
            }}
          >
            Back to sign in
          </button>
        )}

        <p className="auth-switch">
          Don't have an account?{" "}
          <button className="auth-switch__link" onClick={() => onNavigate("signup")}>
            Sign up free
          </button>
        </p>
      </div>
    </div>
  );
}
