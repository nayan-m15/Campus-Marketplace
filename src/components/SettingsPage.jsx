import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { validatePassword } from "../utils/passwordValidation";

export default function SettingsPage({ onBack, onSignOut, onAccountDeleted }) {
  const { user } = useAuth();
  const notifSavedTimeoutRef = useRef(null);

  // ── Password ──
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── Notifications ──
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifListingActivity, setNotifListingActivity] = useState(true);
  const [notifSaved, setNotifSaved] = useState(false);
  const [notifPermissionMsg, setNotifPermissionMsg] = useState("");
  // ── Appearance ──
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  // ── Delete account ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function handleDarkMode(val) {
    setDarkMode(val);
    if (val) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  // ── Load notification prefs from profile ──
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("notif_messages, notif_listing_activity")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.notif_messages != null) setNotifMessages(data.notif_messages);
        if (data?.notif_listing_activity != null) setNotifListingActivity(data.notif_listing_activity);
      });
  }, [user]);

  useEffect(() => () => {
    if (notifSavedTimeoutRef.current) {
      clearTimeout(notifSavedTimeoutRef.current);
    }
  }, []);

  async function handleChangePassword() {
    setPasswordMsg(null);
    setPasswordErrors([]);

    // Validate all password rules individually
    const { valid, errors: pwErrors } = validatePassword(newPassword);
    if (!valid) {
      setPasswordErrors(pwErrors);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrors(["Passwords do not match."]);
      return;
    }

    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);

    if (error) {
      setPasswordErrors([error.message]);
    } else {
      setPasswordMsg("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleSaveNotifications() {
    if (!user) return;
    setNotifPermissionMsg("");

    if ((notifMessages || notifListingActivity) && "Notification" in window) {
      if (window.Notification.permission === "default") {
        const permission = await window.Notification.requestPermission();
        if (permission === "granted") {
          setNotifPermissionMsg("Browser notifications enabled.");
        } else {
          setNotifPermissionMsg("Browser notifications are blocked, so alerts will only show while the app is open.");
        }
      } else if (window.Notification.permission === "denied") {
        setNotifPermissionMsg("Browser notifications are blocked in this browser.");
      }
    } else if (notifMessages || notifListingActivity) {
      setNotifPermissionMsg("This browser does not support desktop notifications.");
    }

    await supabase
      .from("profiles")
      .update({
        notif_messages: notifMessages,
        notif_listing_activity: notifListingActivity,
      })
      .eq("id", user.id);
    setNotifSaved(true);
    if (notifSavedTimeoutRef.current) {
      clearTimeout(notifSavedTimeoutRef.current);
    }
    notifSavedTimeoutRef.current = setTimeout(() => {
      setNotifSaved(false);
      notifSavedTimeoutRef.current = null;
    }, 3000);
  }

  async function handleDeleteAccount() {
    if (!user) {
      setDeleteError("You must be logged in to delete your account.");
      return;
    }

    if (deleteConfirmText !== "DELETE") {
      setDeleteError('Please type "DELETE" to confirm.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const { error } = await supabase.rpc("delete_my_account");

      if (error) throw error;

      await supabase.auth.signOut();
      onSignOut?.();
      onAccountDeleted?.();
    } catch (err) {
      setDeleteError(err.message || "Failed to delete account.");
    } finally {
      setDeleteLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 9,
    border: "1.5px solid #e5e7eb",
    fontSize: 14,
    fontFamily: "var(--font)",
    outline: "none",
    boxSizing: "border-box",
    background: "#f9fafb",
  };

  const sectionStyle = {
    background: "var(--surface)",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    border: "1px solid var(--gray-200)",
    marginBottom: 24,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--gray-800)",
    marginBottom: 6,
    display: "block",
  };

  const toggleStyle = (active) => ({
    width: 44,
    height: 24,
    borderRadius: 12,
    background: active ? "var(--green)" : "#d1d5db",
    border: "none",
    cursor: "pointer",
    position: "relative",
    transition: "background 0.2s",
    flexShrink: 0,
  });

  const toggleKnobStyle = (active) => ({
    position: "absolute",
    top: 3,
    left: active ? 23 : 3,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#fff",
    transition: "left 0.2s",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--page-bg, #f9fafb)", padding: "32px 40px", fontFamily: "var(--font)", maxWidth: 600, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 9, padding: "8px 16px", cursor: "pointer", fontSize: 14, color: "var(--gray-800)", fontFamily: "var(--font)" }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>Settings</h1>
      </div>

      {/* ── Change Password ── */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--gray-900)" }}>Change Password</h2>

        {!user ? (
          <p style={{ fontSize: 14, color: "var(--gray-600)", margin: 0 }}>
            You must be logged in to change your password.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>New password</label>
              <input
                type="password"
                style={inputStyle}
                placeholder="Min. 6 chars, upper & lowercase, 1 number"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm new password</label>
              <input
                type="password"
                style={inputStyle}
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {/* Each failed rule shown as its own line */}
            {passwordErrors.length > 0 && (
              <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 4 }}>
                {passwordErrors.map((msg) => (
                  <li key={msg} style={{ color: "#ef4444", fontSize: 13 }}>{msg}</li>
                ))}
              </ul>
            )}

            {passwordMsg && (
              <p style={{ color: "var(--green)", fontSize: 13, margin: 0 }}>{passwordMsg}</p>
            )}

            <button
              onClick={handleChangePassword}
              disabled={passwordLoading}
              style={{ alignSelf: "flex-start", padding: "10px 24px", borderRadius: 9, border: "none", background: "var(--green)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "var(--font)", opacity: passwordLoading ? 0.7 : 1 }}
            >
              {passwordLoading ? "Updating…" : "Update password"}
            </button>
          </div>
        )}
      </section>

      {/* ── Notification Preferences ── */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--gray-900)" }}>Notification Preferences</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: "var(--gray-900)" }}>New messages</p>
              <p style={{ fontSize: 12, color: "var(--gray-600)", margin: "2px 0 0" }}>Get notified when someone messages you</p>
            </div>
            <button
              style={toggleStyle(notifMessages)}
              onClick={() => setNotifMessages((prev) => !prev)}
              aria-label="Toggle message notifications"
            >
              <span style={toggleKnobStyle(notifMessages)} />
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: "var(--gray-900)" }}>Listing activity</p>
              <p style={{ fontSize: 12, color: "var(--gray-600)", margin: "2px 0 0" }}>Get notified when someone views or messages about your listing</p>
            </div>
            <button
              style={toggleStyle(notifListingActivity)}
              onClick={() => setNotifListingActivity((prev) => !prev)}
              aria-label="Toggle listing activity notifications"
            >
              <span style={toggleKnobStyle(notifListingActivity)} />
            </button>
          </div>

          {notifSaved && <p style={{ color: "var(--green)", fontSize: 13, margin: 0 }}>Preferences saved!</p>}
          {notifPermissionMsg && <p style={{ color: "var(--gray-600)", fontSize: 13, margin: 0 }}>{notifPermissionMsg}</p>}

          <button
            onClick={handleSaveNotifications}
            style={{ alignSelf: "flex-start", padding: "10px 24px", borderRadius: 9, border: "none", background: "var(--green)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "var(--font)" }}
          >
            Save preferences
          </button>
        </div>
      </section>

      {/* ── Appearance ── */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--gray-900)" }}>Appearance</h2>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: "var(--gray-900)" }}>Dark mode</p>
            <p style={{ fontSize: 12, color: "var(--gray-600)", margin: "2px 0 0" }}>Switch between light and dark theme</p>
          </div>
          <button
            style={toggleStyle(darkMode)}
            onClick={() => handleDarkMode(!darkMode)}
            aria-label="Toggle dark mode"
          >
            <span style={toggleKnobStyle(darkMode)} />
          </button>
        </div>
      </section>

      {/* ── Delete Account ── */}
      <section style={{ ...sectionStyle, border: "1px solid #fee2e2" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#ef4444" }}>🗑️ Delete Account</h2>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 20 }}>
          This permanently deletes your account, all your listings, and all your data. This cannot be undone.
        </p>

        {!user ? (
          <p style={{ fontSize: 14, color: "var(--gray-600)", margin: 0 }}>
            You must be logged in to delete your account.
          </p>
        ) : !showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{ padding: "10px 24px", borderRadius: 9, border: "1.5px solid #ef4444", background: "#fff", color: "#ef4444", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "var(--font)" }}
          >
            Delete my account
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-800)", margin: 0 }}>
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              style={{ ...inputStyle, borderColor: "#ef4444" }}
              placeholder="DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
            {deleteError && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>⚠️ {deleteError}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); setDeleteError(null); }}
                style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "var(--font)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                style={{ padding: "10px 20px", borderRadius: 9, border: "none", background: "#ef4444", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "var(--font)", opacity: deleteLoading ? 0.7 : 1 }}
              >
                {deleteLoading ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
