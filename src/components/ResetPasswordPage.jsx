import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { validatePassword } from "../utils/passwordValidation";
import "../styles/Auth.css";

export default function ResetPasswordPage({ onComplete, autoContinueDelayMs = 1500 }) {
  const { clearPasswordRecovery } = useAuth();
  const autoContinueTimeoutRef = useRef(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    return () => {
      if (autoContinueTimeoutRef.current) {
        clearTimeout(autoContinueTimeoutRef.current);
      }
    };
  }, []);

  function completeResetFlow() {
    if (autoContinueTimeoutRef.current) {
      clearTimeout(autoContinueTimeoutRef.current);
      autoContinueTimeoutRef.current = null;
    }

    onComplete();
  }

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

    clearPasswordRecovery();
    setSuccess("Your password has been reset successfully.");

    if (autoContinueDelayMs !== null) {
      autoContinueTimeoutRef.current = setTimeout(completeResetFlow, autoContinueDelayMs);
    }
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
            <button type="button" className="btn-primary auth-submit" onClick={completeResetFlow}>
              Continue to marketplace
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field">
              <label htmlFor="reset-password">New password</label>
              <div className="auth-password-control">
                <input
                  id="reset-password"
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
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reset-password-confirm">Confirm new password</label>
              <div className="auth-password-control">
                <input
                  id="reset-password-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  aria-pressed={showConfirmPassword}
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
                    {showConfirmPassword && <path d="M4 20 20 4" />}
                  </svg>
                </button>
              </div>
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
