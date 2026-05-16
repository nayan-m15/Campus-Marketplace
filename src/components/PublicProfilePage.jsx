// Main structure for the public profile page feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import VerifiedBadge from "./VerifiedBadge";
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
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Rating display state — populated from profile columns (avg_rating, rating_count)
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);

  const [activeTab, setActiveTab] = useState("details");
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // ── Load profile (includes avg_rating + rating_count columns) ──
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select(
        "name, display_name, about, province, institution, sex, birthdate, avatar_url, created_at, avg_rating, rating_count, email, is_verified, verified_university"
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
                <VerifiedBadge user={profile} showUniversity />
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

              </>
            )}

          </article>
        </article>
      </article>
    </article>
  );
}
