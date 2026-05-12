// Main structure for the signup page feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getAppBaseUrl } from "../utils/appUrl";
import { validatePassword } from "../utils/passwordValidation";
import "../styles/Auth.css";

const EMAIL_REGISTERED_MESSAGE = "Email is already registered. Try signing in instead.";

// Quick guard logic sits here for this decision point.
// The check keeps the rest of the flow cleaner to read.
function isEmailAlreadyRegistered({ data, error }) {
  const message = error?.message?.toLowerCase() || "";

  return (
    message.includes("already registered") ||
    message.includes("user already exists") ||
    message.includes("already been registered") ||
    error?.status === 422 ||
    (Array.isArray(data?.user?.identities) && data.user.identities.length === 0)
  );
}

// Component entry point for this part of the interface.
// Rendering and feature-specific behavior are coordinated here.
export default function SignupPage({ onNavigate }) {
  const { signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors([]);

    // Validate password rules
    const { valid, errors: pwErrors } = validatePassword(password);
    if (!valid) {
      setErrors(pwErrors);
      return;
    }

    if (password !== confirm) {
      setErrors(["Passwords do not match."]);
      return;
    }

    setLoading(true);
    const redirectTo = getAppBaseUrl();

    const { data, error } = await signUp(email, password, {
      emailRedirectTo: redirectTo,
    });

    setLoading(false);

    if (isEmailAlreadyRegistered({ data, error })) {
      setErrors([EMAIL_REGISTERED_MESSAGE]);
      return;
    }

    if (error) {
      setErrors([error.message]);
      return;
    }

    setSuccess(true);
  }

  async function handleGoogle() {
    setErrors([]);
    setGoogleLoading(true);
    const redirectTo = getAppBaseUrl();
    const { error } = await signInWithGoogle({ redirectTo });
    setGoogleLoading(false);
    if (error) setErrors([error.message]);
  }

  if (success) {
    return (
      <section className="auth-page">
        <article className="auth-card auth-card--success">
          <span className="auth-success-icon">✉️</span>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-subtitle">
            We've sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then come back to sign in.
          </p>
          <button className="btn-primary auth-submit" onClick={() => onNavigate("login")}>
            Back to Sign In
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <article className="auth-card">
        <button
          className="auth-back-btn"
          type="button"
          onClick={() => onNavigate("home")}
        >
          ←
        </button>

        {/* Logo */}
        <section className="auth-logo">
          <span className="auth-logo__icon">
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="CAMPUSXCHANGE Logo" className="navbar__logo-img" />
          </span>
          <span className="auth-logo__text">CAMPUSXCHANGE</span>
        </section>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Join the campus marketplace — free for students</p>

        {/* Google Button */}
        <button
          className="auth-google-btn"
          onClick={handleGoogle}
          disabled={googleLoading}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {googleLoading ? "Redirecting…" : "Sign up with Google"}
        </button>

        <span className="auth-divider">
          <span>or sign up with email</span>
        </span>

        {/* Validation errors — each rule shown separately */}
        {errors.length > 0 && (
          <ul className="auth-error auth-error--list" role="alert">
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <section className="auth-field">
            <label htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              type="email"
              placeholder="you@university.ac.za"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </section>

          <section className="auth-field">
            <label htmlFor="signup-password">Password</label>
            <section className="auth-password-control">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 6 chars, upper & lowercase, 1 number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="M4 20 20 4" />}
                </svg>
              </button>
            </section>
          </section>

          <section className="auth-field">
            <label htmlFor="signup-confirm">Confirm password</label>
            <section className="auth-password-control">
              <input
                id="signup-confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowConfirm((current) => !current)}
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                aria-pressed={showConfirm}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showConfirm && <path d="M4 20 20 4" />}
                </svg>
              </button>
            </section>
          </section>

          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? "Creating account…" : "Create Account →"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <button className="auth-switch__link" onClick={() => onNavigate("login")}>
            Sign in
          </button>
        </p>
      </article>
    </section>
  );
}
