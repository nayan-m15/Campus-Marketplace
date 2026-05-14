/**
 * passwordValidation.js
 * Shared password validation rules for CAMPUSXCHANGE.
 * Import and use in SignupPage, SettingsPage, or any auth flow.
 */

export const PASSWORD_RULES = [
  {
    id: "minLength",
    test: (pw) => pw.length >= 6,
    message: "Password must be at least 6 characters.",
  },
  {
    id: "uppercase",
    test: (pw) => /[A-Z]/.test(pw),
    message: "Password must contain at least one uppercase letter.",
  },
  {
    id: "lowercase",
    test: (pw) => /[a-z]/.test(pw),
    message: "Password must contain at least one lowercase letter.",
  },
  {
    id: "number",
    test: (pw) => /[0-9]/.test(pw),
    message: "Password must contain at least one number.",
  },
];

/*This function validates the password.*/
export function validatePassword(password) {
  const errors = PASSWORD_RULES
    .filter((rule) => !rule.test(password))
    .map((rule) => rule.message);

  return { valid: errors.length === 0, errors };
}
