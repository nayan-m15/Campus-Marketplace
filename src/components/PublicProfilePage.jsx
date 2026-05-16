// Main structure for the public profile page feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import "../styles/ProfilePage.css";

// ── Star display (read-only) ─────────────────────────────────
function StarDisplay({ average = 0, count = 0 }) {
  return (
    <section className="pub-rating__display">
      <section className="pub-rating__stars">
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
      </section>
      <span className="pub-rating__label">
        {count > 0
          ? `${average} (${count} review${count !== 1 ? "s" : ""})`
          : "No reviews yet"}
      </span>
    </section>
  );
}

// ── Interactive star picker ──────────────────────────────────
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <section className="pub-rating__picker">
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
    </section>
  );
}

// ── Main Component ───────────────────────────────────────────
function getListingImage(listing) {
  if (!listing) return "";
  if (listing.image_url) return listing.image_url;
  if (Array.isArray(listing.image_urls)) return listing.image_urls.find(Boolean) || "";
  return "";
}

function mapRpcTransactionHistory(rows) {
  return (rows || [])
    .filter((row) => row?.transaction_id)
    .map((row) => ({
      id: row.transaction_id,
      itemTitle: row.item_title || "Transaction item",
      imageUrl: row.item_image_url || "",
      otherUserName: row.other_user_name || "Unknown user",
      relationshipLabel: row.relationship_label || "Traded with",
    }));
}

function TransactionHistory({ transactions, loading }) {
  if (loading) {
    return <p className="pub-transactions__empty">Loading transaction history...</p>;
  }

  if (transactions.length === 0) {
    return (
      <section className="pub-transactions__empty-card">
        <p>No transaction history yet.</p>
      </section>
    );
  }

  return (
    <ul className="pub-transactions__list">
      {transactions.map((transaction) => (
        <li key={transaction.id} className="pub-transaction">
          <figure className="pub-transaction__image">
            {transaction.imageUrl ? (
              <img src={transaction.imageUrl} alt={transaction.itemTitle} />
            ) : (
              <span>{transaction.itemTitle?.[0]?.toUpperCase() || "I"}</span>
            )}
          </figure>
          <section className="pub-transaction__body">
            <strong>{transaction.itemTitle}</strong>
            <span>{transaction.relationshipLabel} {transaction.otherUserName}</span>
          </section>
        </li>
      ))}
    </ul>
  );
}

export default function PublicProfilePage({ userId, onBack, onMessageSeller }) {
  const { user } = useAuth();
  const { notifySuccess, notifyError, notifyWarning } = useNotifications();

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
  const [activeTab, setActiveTab] = useState("details");
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

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
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadTransactionHistory() {
      setTransactionsLoading(true);
      try {
        const { data: rpcRows, error: rpcError } = await supabase.rpc(
          "get_public_transaction_history",
          { p_profile_user_id: userId }
        );

        const rpcHistory = !rpcError ? mapRpcTransactionHistory(rpcRows) : [];
        if (rpcHistory.length > 0) {
          if (!cancelled) setTransactionHistory(rpcHistory);
          return;
        }

        const { data: rows, error } = await supabase
          .from("transactions")
          .select("id, item, listing_id, requested_listing_id, offered_listing_id, seller_id, buyer_id, transaction_type, status, created_at")
          .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const transactions = rows || [];
        const listingIds = [
          ...new Set(
            transactions
              .flatMap((transaction) => [
                transaction.listing_id,
                transaction.requested_listing_id,
                transaction.offered_listing_id,
              ])
              .filter(Boolean)
          ),
        ];
        const otherUserIds = [
          ...new Set(
            transactions
              .map((transaction) =>
                transaction.seller_id === userId ? transaction.buyer_id : transaction.seller_id
              )
              .filter(Boolean)
          ),
        ];

        const [{ data: listings }, { data: profiles }] = await Promise.all([
          listingIds.length
            ? supabase
                .from("listings")
                .select("id, title, image_url, image_urls")
                .in("id", listingIds)
            : Promise.resolve({ data: [] }),
          otherUserIds.length
            ? supabase
                .from("profiles")
                .select("id, display_name, name")
                .in("id", otherUserIds)
            : Promise.resolve({ data: [] }),
        ]);

        const listingById = Object.fromEntries((listings || []).map((listing) => [listing.id, listing]));
        const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));

        const history = transactions.map((transaction) => {
          const isSeller = transaction.seller_id === userId;
          const otherUserId = isSeller ? transaction.buyer_id : transaction.seller_id;
          const listingId =
            transaction.listing_id ||
            transaction.requested_listing_id ||
            transaction.offered_listing_id;
          const listing = listingById[listingId] || null;
          const otherProfile = profileById[otherUserId] || null;
          const otherUserName =
            otherProfile?.display_name ||
            otherProfile?.name ||
            (otherUserId ? String(otherUserId).slice(0, 8) : "Unknown user");

          return {
            id: transaction.id,
            itemTitle: listing?.title || transaction.item || "Transaction item",
            imageUrl: getListingImage(listing),
            otherUserName,
            relationshipLabel: isSeller ? "Sold to" : "Bought from",
          };
        });

        if (!cancelled) setTransactionHistory(history);
      } catch (err) {
        console.error("Failed to load transaction history:", err.message);
        if (!cancelled) setTransactionHistory([]);
      } finally {
        if (!cancelled) setTransactionsLoading(false);
      }
    }

    loadTransactionHistory();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  function showToast(msg) {
    if (msg.toLowerCase().includes("please select")) {
      notifyWarning("Rating incomplete", msg, { category: "profile", dedupeKey: `rating-warning-${msg}` });
      return;
    }

    if (msg.toLowerCase().includes("submitted")) {
      notifySuccess("Rating submitted", msg, { category: "profile", dedupeKey: `rating-success-${msg}` });
      return;
    }

    notifyError("Rating failed", msg, { category: "profile", dedupeKey: `rating-error-${msg}` });
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

      showToast("Rating submitted!");
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
      showToast(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / error states ────────────────────────────────────
  if (loading) {
    return (
      <section
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
      </section>
    );
  }

  if (error || !profile) {
    return (
      <article className="profile-page">
        <article className="profile-page__inner">
          <button className="profile-page__back" onClick={onBack}>← Back</button>
          <p style={{ color: "rgba(255,255,255,0.4)", marginTop: 16 }}>
            {error || "Profile not found."}
          </p>
        </article>
      </article>
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
    <article className="profile-page">
      <article className="profile-page__inner">
        <button className="profile-page__back" onClick={onBack}>← Back</button>

        <article className="profile-card">
          {/* Avatar header */}
          <article className="profile-card__avatar-section">
            <article className="profile-card__avatar-wrap">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="profile-card__avatar"
                />
              ) : (
                <article className="profile-card__avatar-placeholder">{initials}</article>
              )}
            </article>

            <article className="profile-card__avatar-info">
              <article className="pub-profile__name-row">
                <h2>{displayName}</h2>
                <StarDisplay average={ratingAvg} count={ratingCount} />
              </article>
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
            </article>
          </article>

          <nav className="profile-tabs" aria-label="Profile sections">
            <button
              type="button"
              className={`profile-tabs__button${activeTab === "details" ? " profile-tabs__button--active" : ""}`}
              onClick={() => setActiveTab("details")}
            >
              Details
            </button>
            <button
              type="button"
              className={`profile-tabs__button${activeTab === "transactions" ? " profile-tabs__button--active" : ""}`}
              onClick={() => setActiveTab("transactions")}
            >
              Transaction history
            </button>
          </nav>

          {/* Read-only profile body */}
          <article className="profile-card__body">
            {activeTab === "transactions" ? (
              <>
                <p className="profile-section-title">Transaction History</p>
                <TransactionHistory transactions={transactionHistory} loading={transactionsLoading} />
              </>
            ) : (
              <>

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
                <article className="profile-field-row">
                  {profile.sex && (
                    <article className="profile-field">
                      <label>Sex</label>
                      <article className="profile-public-value">{profile.sex}</article>
                    </article>
                  )}
                  {profile.birthdate && (
                    <article className="profile-field">
                      <label>Date of birth</label>
                      <article className="profile-public-value">
                        {new Date(profile.birthdate).toLocaleDateString("en-ZA", {
                          day:   "2-digit",
                          month: "long",
                          year:  "numeric",
                        })}
                      </article>
                    </article>
                  )}
                </article>
              </>
            )}

            {(profile.province || profile.institution) && (
              <>
                <p className="profile-section-title">Location & Institution</p>
                <article className="profile-field-row">
                  {profile.province && (
                    <article className="profile-field">
                      <label>Province</label>
                      <article className="profile-public-value">{profile.province}</article>
                    </article>
                  )}
                  {profile.institution && (
                    <article className="profile-field">
                      <label>University / College</label>
                      <article className="profile-public-value">{profile.institution}</article>
                    </article>
                  )}
                </article>
              </>
            )}

            {/* ── Rate this user ── */}
            {user && user.id !== userId && rateableListings.length > 0 && (
              <>
                <p className="profile-section-title">Rate this user</p>
                <section className="pub-rating__form">
                  <article className="profile-field">
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
                  </article>

                {/* Show rating picker only if this listing hasn't been rated yet */}
                {selectedListingData && !selectedListingData.existingRating && (
                  <article className="profile-field">
                    <label>Your rating</label>
                    <StarPicker value={selectedStars} onChange={setSelectedStars} />
                  </article>
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
  </section>
  </>
)}
              </>
            )}

          </article>
        </article>
      </article>
    </article>
  );
}
