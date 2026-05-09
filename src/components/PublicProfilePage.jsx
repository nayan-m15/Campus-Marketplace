// Main structure for the public profile page feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import "../styles/ProfilePage.css";

// ── Star display (read-only) ─────────────────────────────────
function StarDisplay({ average = 0, count = 0 }) {
  return (
    <div className="pub-rating__display">
      <div className="pub-rating__stars">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = average >= i;
          const half = !filled && average >= i - 0.5;
          return (
            <span
              key={i}
              className={`pub-rating__star ${filled ? "pub-rating__star--filled" : half ? "pub-rating__star--half" : ""}`}
            >
              ★
            </span>
          );
        })}
      </div>
      <span className="pub-rating__label">
        {count > 0
          ? `${average} (${count} review${count !== 1 ? "s" : ""})`
          : "No reviews yet"}
      </span>
    </div>
  );
}

// ── Interactive star picker ──────────────────────────────────
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="pub-rating__picker">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          className={`pub-rating__pick-star ${i <= (hovered || value) ? "pub-rating__pick-star--on" : ""}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i)}
          aria-label={`Rate ${i} star${i !== 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function PublicProfilePage({ userId, onBack, onMessageSeller }) {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Rating display state — populated from profile columns (avg_rating, rating_count)
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);

  // Listings the current user has messaged the seller about
  const [rateableListings, setRateableListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState("");
  const [selectedStars, setSelectedStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [ratingToast, setRatingToast] = useState(null);

  // ── Load profile (includes avg_rating + rating_count columns) ──
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select(
        "name, display_name, about, province, institution, sex, birthdate, avatar_url, created_at, avg_rating, rating_count"
      )
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError("Could not load this profile.");
        } else {
          setProfile(data);
          // Populate rating state directly from the stored columns — no RPC needed
          setRatingAvg(parseFloat(data.avg_rating) || 0);
          setRatingCount(parseInt(data.rating_count) || 0);
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  // ── Load listings the current user can rate this seller for ──
  useEffect(() => {
    if (!user || !userId || user.id === userId) return;

    async function loadRateableListings() {
      // Source 1: listings the user messaged the seller about
      const { data: msgData } = await supabase
        .from("messages")
        .select("listing_id")
        .eq("sender_id", user.id)
        .eq("receiver_id", userId)
        .not("listing_id", "is", null);

      // Source 2: completed transactions where both parties were involved
      const { data: txnData } = await supabase
        .from("transactions")
        .select("listing_id")
        .eq("status", "completed")
        .or(
          `and(buyer_id.eq.${user.id},seller_id.eq.${userId}),and(seller_id.eq.${user.id},buyer_id.eq.${userId})`
        )
        .not("listing_id", "is", null);

      const allListingIds = [
        ...new Set([
          ...(msgData || []).map((m) => m.listing_id),
          ...(txnData || []).map((t) => t.listing_id),
        ]),
      ].filter(Boolean);

      if (allListingIds.length === 0) return;

      const { data: listings } = await supabase
        .from("listings")
        .select("id, title")
        .in("id", allListingIds);

      if (!listings) return;

      // Check which ones the user has already rated
      const { data: existingRatings } = await supabase
        .from("ratings")
        .select("listing_id, rating")
        .eq("rater_id", user.id)
        .eq("rated_id", userId);

      const ratedMap = Object.fromEntries(
        (existingRatings || []).map((r) => [r.listing_id, r.rating])
      );

      setRateableListings(
        listings.map((l) => ({
          ...l,
          existingRating: ratedMap[l.id] || null,
        }))
      );
    }

    loadRateableListings();
  }, [user, userId]);

  // ── Helpers ──────────────────────────────────────────────────
  function showToast(msg) {
    setRatingToast(msg);
    setTimeout(() => setRatingToast(null), 3000);
  }

  async function handleSubmitRating() {
    if (!selectedListing) { showToast("Please select a listing first."); return; }
    if (!selectedStars)    { showToast("Please select a star rating.");   return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("ratings").insert({
        rater_id: user.id,
        rated_id: userId,
        listing_id: selectedListing,
        rating: selectedStars,
      });

      if (error) throw new Error(error.message);

      showToast("✅ Rating submitted!");
      setSelectedListing("");
      setSelectedStars(0);

      // Re-fetch the profile row so avg_rating + rating_count reflect the
      // trigger's recalculation — no RPC call required.
      const { data: updated } = await supabase
        .from("profiles")
        .select("avg_rating, rating_count")
        .eq("id", userId)
        .single();

      if (updated) {
        setRatingAvg(parseFloat(updated.avg_rating) || 0);
        setRatingCount(parseInt(updated.rating_count) || 0);
      }

      // Mark the listing as rated in local state
      setRateableListings((prev) =>
        prev.map((l) =>
          l.id === selectedListing ? { ...l, existingRating: selectedStars } : l
        )
      );
    } catch (err) {
      showToast("⚠️ " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / error states ────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.4)",
          background: "linear-gradient(160deg, var(--navy) 0%, var(--gray-900) 100%)",
        }}
      >
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

  // ── Derived display values ────────────────────────────────────
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

  const selectedListingData = rateableListings.find((l) => l.id === selectedListing);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="profile-page">
      {ratingToast && <div className="profile-toast">{ratingToast}</div>}

      <div className="profile-page__inner">
        <button className="profile-page__back" onClick={onBack}>← Back</button>

        <div className="profile-card">
          {/* Avatar header */}
          <div className="profile-card__avatar-section">
            <div className="profile-card__avatar-wrap">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="profile-card__avatar"
                />
              ) : (
                <div className="profile-card__avatar-placeholder">{initials}</div>
              )}
            </div>

            <div className="profile-card__avatar-info">
              <div className="pub-profile__name-row">
                <h2>{displayName}</h2>
                <StarDisplay average={ratingAvg} count={ratingCount} />
              </div>
              {memberSince && <p>🗓 Member since {memberSince}</p>}
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

          {/* Read-only profile body */}
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
                          day:   "2-digit",
                          month: "long",
                          year:  "numeric",
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

            {/* ── Rate this user ── */}
            {user && user.id !== userId && rateableListings.length > 0 && (
              <>
                <p className="profile-section-title">Rate this user</p>
                <div className="pub-rating__form">
                  <div className="profile-field">
                    <label>Select a listing you sold/bought</label>
                    <select
                      value={selectedListing}
                      onChange={(e) => {
                        setSelectedListing(e.target.value);
                        const l = rateableListings.find((l) => l.id === e.target.value);
                        setSelectedStars(l?.existingRating || 0);
                      }}
                    >
                    <option value="">Choose a listing…</option>
                    {rateableListings.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                        {l.existingRating ? ` (rated: ${l.existingRating}★)` : ""}
                      </option>
                    ))}
                    </select>
                  </div>

                {/* Show rating picker only if this listing hasn't been rated yet */}
                {selectedListingData && !selectedListingData.existingRating && (
                  <div className="profile-field">
                    <label>Your rating</label>
                    <StarPicker value={selectedStars} onChange={setSelectedStars} />
                  </div>
                )}

          {selectedListingData?.existingRating ? (
            <p className="pub-rating__existing-note">
              You already rated this listing {selectedListingData.existingRating}★. Ratings cannot be changed after submission.
            </p>
         ) : null}

          {selectedListingData && !selectedListingData.existingRating && (
            <button
              className="profile-save-btn"
              style={{ width: "100%", marginTop: 4 }}
              onClick={handleSubmitRating}
              disabled={submitting || !selectedStars || !selectedListing}
              type="button"
            >
            {submitting ? "Submitting…" : "Submit Rating"}
          </button>
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
