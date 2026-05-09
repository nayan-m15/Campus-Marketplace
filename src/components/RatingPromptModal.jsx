// RatingPromptModal.jsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

function SingleRatingModal({ transaction, currentUserId, onClose }) {
  const dialogRef = useRef(null);
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isSeller = transaction.seller_id === currentUserId;
  const ratedId = transaction.otherUserId;
  const ratedName = transaction.otherUserName || "the other party";
  const role = transaction.role === "seller" ? "buyer" : "seller";

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    try {
      if (!el.open) el.showModal();
    } catch {
      // dialog not yet in the DOM — no-op
    }
  }, []);

  async function handleSubmit() {
    if (!selected) return;

    if (!transaction.listing_id) {
      setError("This transaction is missing a listing reference and cannot be rated.");
      return;
    }

    setSubmitting(true);
    setError("");

    const { error: err } = await supabase.from("ratings").insert({
      rater_id: currentUserId,
      rated_id: ratedId,
      listing_id: transaction.listing_id,
      rating: selected,
    });

    if (err) {
      if (err.code === "23505") {
        // already rated — treat as success
      } else {
        setError(err.message || "Failed to submit rating.");
        setSubmitting(false);
        return;
      }
    }

    const updateField = isSeller
      ? { seller_rating_pending: false }
      : { buyer_rating_pending: false };

    await supabase
      .from("transactions")
      .update(updateField)
      .eq("id", transaction.id);

    // onClose receives the txnId so App.jsx can permanently dismiss it
    onClose(transaction.id);
  }

  const display = hovered || selected;

  return (
    <dialog ref={dialogRef} className="brm-dialog" onClose={() => onClose(null)}>
      <div className="brm-inner">
        <header className="brm-header">
          <span className="brm-header-icon">⭐</span>
          <div className="brm-header-text">
            <h2 className="brm-title">Rate your {role}</h2>
            <p className="brm-subtitle">Transaction for {transaction.item}</p>
          </div>
          <button className="brm-close-btn" onClick={() => onClose(null)} aria-label="Close">✕</button>
        </header>

        <div className="brm-body">
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted, #6b7280)" }}>
            How was your experience with <strong style={{ color: "#111" }}>{ratedName}</strong>?
          </p>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "8px 0" }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setSelected(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 36,
                  padding: "2px 4px",
                  color: star <= display ? "#1f6b52" : "#d1d5db",
                  transition: "color 0.1s, transform 0.1s",
                  transform: star <= display ? "scale(1.15)" : "scale(1)",
                }}
              >
                ★
              </button>
            ))}
          </div>

          {display > 0 && (
            <p style={{ textAlign: "center", margin: 0, fontSize: 13, color: "#6b7280" }}>
              {["", "Poor", "Below average", "Average", "Good", "Excellent"][display]}
            </p>
          )}

          {error && <p className="brm-error">{error}</p>}
        </div>

        <footer className="brm-footer">
          {/* Skip: pass null so App does NOT permanently dismiss — user can still rate on profile page */}
          <button className="btn-secondary" onClick={() => onClose(null)} disabled={submitting}>
            Skip
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!selected || submitting}
          >
            {submitting ? "Submitting…" : "Submit rating"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

export default function RatingPromptModal({ pendingRatings, currentUserId, onDone }) {
  const [index, setIndex] = useState(0);

  if (!pendingRatings?.length) return null;

  const current = pendingRatings[index];
  if (!current) return null;

  function handleClose(txnId) {
    const wasSubmitted = txnId !== null;
    onDone(current.id, wasSubmitted);
  }

  return (
    <SingleRatingModal
      key={current.id}
      transaction={current}
      currentUserId={currentUserId}
      onClose={handleClose}
    />
  );
}