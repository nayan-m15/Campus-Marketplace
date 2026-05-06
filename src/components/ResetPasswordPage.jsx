import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { validatePassword } from "../utils/passwordValidation";
import "../styles/Auth.css";

export default function ResetPasswordPage({ onComplete }) {
  const { clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors([]);
    setSuccess("");

    const { valid, errors: passwordErrors } = validatePassword(password);
    if (!valid) {
      setErrors(passwordErrors);
      return;
    }

    if (password !== confirmPassword) {
      setErrors(["Passwords do not match."]);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrors([error.message]);
      return;
    }

    // Clear the recovery state and sign out the recovery session
    clearPasswordRecovery();
    await supabase.auth.signOut();
    setSuccess("Your password has been reset successfully.");
    
    // Clear the recovery URL parameters so user can't accidentally re-trigger recovery
    window.history.replaceState({}, "", window.location.pathname);
    
    // After a brief delay, redirect to login
    setTimeout(() => {
      onComplete();
    }, 1500);
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--success">
        <div className="auth-logo">
          <span className="auth-logo__icon">
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="CAMPUSXCHANGE Logo" className="navbar__logo-img" />
          </span>
          <span className="auth-logo__text">CAMPUSXCHANGE</span>
        </div>

        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-subtitle">Choose a new password for your account.</p>

        {errors.length > 0 && (
          <ul className="auth-error auth-error--list" role="alert">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {success ? (
          <>
            <p className="auth-success-message">{success}</p>
            <p style={{ textAlign: "center", color: "var(--gray-500)", fontSize: "14px" }}>
              Redirecting to login...
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field">
              <label htmlFor="reset-password">New password</label>
              <input
                id="reset-password"
                type="password"
                placeholder="Min. 6 chars, upper & lowercase, 1 number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="reset-password-confirm">Confirm new password</label>
              <input
                id="reset-password-confirm"
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? "Updating password..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
