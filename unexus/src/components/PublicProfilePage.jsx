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
        {count > 0 ? `${average} (${count} review${count !== 1 ? "s" : ""})` : "No reviews yet"}
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

  // Rating state
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);

  // Listings the current user has messaged the seller about
  const [rateableListings, setRateableListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState("");
  const [selectedStars, setSelectedStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [ratingToast, setRatingToast] = useState(null);

  // Load profile
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

  // Load average rating via RPC
  useEffect(() => {
    if (!userId) return;
    supabase
      .rpc("get_seller_rating", { seller_id: userId })
      .then(({ data }) => {
        if (data && data[0]) {
          setRatingAvg(parseFloat(data[0].average) || 0);
          setRatingCount(parseInt(data[0].count) || 0);
        }
      });
  }, [userId]);

  // Load listings the current user has messaged the seller about
  useEffect(() => {
    if (!user || !userId || user.id === userId) return;

    supabase
      .from("messages")
      .select("listing_id")
      .eq("sender_id", user.id)
      .eq("receiver_id", userId)
      .not("listing_id", "is", null)
      .then(async ({ data: msgData }) => {
        if (!msgData || msgData.length === 0) return;

        const listingIds = [...new Set(msgData.map((m) => m.listing_id))];

        const { data: listings } = await supabase
          .from("listings")
          .select("id, title")
          .in("id", listingIds);

        if (!listings) return;

        // Check which ones they've already rated
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
      });
  }, [user, userId]);

  function showToast(msg) {
    setRatingToast(msg);
    setTimeout(() => setRatingToast(null), 3000);
  }

  async function handleSubmitRating() {
    if (!selectedListing) { showToast("Please select a listing first."); return; }
    if (!selectedStars) { showToast("Please select a star rating."); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("ratings").upsert(
        {
          rater_id: user.id,
          rated_id: userId,
          listing_id: selectedListing,
          rating: selectedStars,
        },
        { onConflict: "rater_id,listing_id" }
      );
      if (error) throw new Error(error.message);

      showToast("✅ Rating submitted!");
      setSelectedListing("");
      setSelectedStars(0);

      // Refresh average
      const { data } = await supabase.rpc("get_seller_rating", { seller_id: userId });
      if (data && data[0]) {
        setRatingAvg(parseFloat(data[0].average) || 0);
        setRatingCount(parseInt(data[0].count) || 0);
      }

      // Update local rateable listings
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

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", background: "linear-gradient(160deg, var(--navy) 0%, var(--gray-900) 100%)" }}>
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

  const selectedListingData = rateableListings.find((l) => l.id === selectedListing);

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
                <img src={profile.avatar_url} alt={displayName} className="profile-card__avatar" />
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

            {/* ── Rate this seller ── */}
            {user && user.id !== userId && rateableListings.length > 0 && (
              <>
                <p className="profile-section-title">Rate this seller</p>
                <div className="pub-rating__form">
                  <div className="profile-field">
                    <label>Select a listing you bought</label>
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
                          {l.title}{l.existingRating ? ` (rated: ${l.existingRating}★)` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="profile-field">
                    <label>Your rating</label>
                    <StarPicker value={selectedStars} onChange={setSelectedStars} />
                  </div>

                  {selectedListingData?.existingRating && (
                    <p className="pub-rating__existing-note">
                      You previously rated this listing {selectedListingData.existingRating}★ — submitting will update it.
                    </p>
                  )}

                  <button
                    className="profile-save-btn"
                    style={{ width: "100%", marginTop: 4 }}
                    onClick={handleSubmitRating}
                    disabled={submitting || !selectedStars || !selectedListing}
                    type="button"
                  >
                    {submitting ? "Submitting…" : "Submit Rating"}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
