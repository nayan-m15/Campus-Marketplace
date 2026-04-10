import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "../styles/ProfilePage.css";

export default function PublicProfilePage({ userId, onBack, onMessageSeller }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    supabase
      .from("profiles")
      .select("name, display_name, about, province, institution, sex, birthdate, avatar_url, created_at")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error) setError("Could not load this profile.");
        else setProfile(data);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", background: "linear-gradient(160deg, #020402 0%, #1F241F 100%)" }}>
        Loading profile…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-page">
        <div className="profile-page__inner">
          <button className="profile-page__back" onClick={onBack}>← Back</button>
          <p style={{ color: "rgba(255,255,255,0.4)", marginTop: 16 }}>
            {error || "Profile not found."}
          </p>
        </div>
      </div>
    );
  }

  const displayName = profile.display_name || profile.name || "Anonymous";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-ZA", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="profile-page">
      <div className="profile-page__inner">
        <button className="profile-page__back" onClick={onBack}>← Back</button>

        <div className="profile-card">
          {/* Avatar header */}
          <div className="profile-card__avatar-section">
            <div className="profile-card__avatar-wrap">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="profile-card__avatar" />
              ) : (
                <div className="profile-card__avatar-placeholder">{initials}</div>
              )}
            </div>

            <div className="profile-card__avatar-info">
              <h2>{displayName}</h2>
              {memberSince && (
                <p>🗓 Member since {memberSince}</p>
              )}
              {onMessageSeller && (
                <button
                  className="profile-save-btn"
                  style={{ marginTop: 14, height: 38, padding: "0 22px", fontSize: 13 }}
                  onClick={onMessageSeller}
                  type="button"
                >
                  💬 Message
                </button>
              )}
            </div>
          </div>

          {/* Read-only body */}
          <div className="profile-card__body">

            {profile.about && (
              <>
                <p className="profile-section-title">About</p>
                <p style={{ fontSize: 14, color: "#758173", lineHeight: 1.6, marginBottom: 16 }}>
                  {profile.about}
                </p>
              </>
            )}

            {(profile.sex || profile.birthdate) && (
              <>
                <p className="profile-section-title">Details</p>
                <div className="profile-field-row">
                  {profile.sex && (
                    <div className="profile-field">
                      <label>Sex</label>
                      <div className="profile-public-value">{profile.sex}</div>
                    </div>
                  )}
                  {profile.birthdate && (
                    <div className="profile-field">
                      <label>Date of birth</label>
                      <div className="profile-public-value">
                        {new Date(profile.birthdate).toLocaleDateString("en-ZA", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {(profile.province || profile.institution) && (
              <>
                <p className="profile-section-title">Location & Institution</p>
                <div className="profile-field-row">
                  {profile.province && (
                    <div className="profile-field">
                      <label>Province</label>
                      <div className="profile-public-value">{profile.province}</div>
                    </div>
                  )}
                  {profile.institution && (
                    <div className="profile-field">
                      <label>University / College</label>
                      <div className="profile-public-value">{profile.institution}</div>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
