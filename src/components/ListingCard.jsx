// Main structure for the listing card feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { CONDITION_COLORS } from "../data/listings";
import VerifiedBadge from "./VerifiedBadge";
import "../styles/ListingCard.css";

// Component entry point for this part of the interface.
// Rendering and feature-specific behavior are coordinated here.
export default function ListingCard({
  item,
  onClick,
  onMessageSeller,
  onSellerClick,
  isAdmin = false,
  onModerate,
  // Wishlist props
  isWishlisted = false,
  onToggleWishlist,
  user,
}) {
  const conditionColor = CONDITION_COLORS[item.condition] || "#6b7280";
  const listingType = String(item.listing_type || "sale").toLowerCase();
  const isSaleAndTrade =
    item.status === "for_trade" ||
    ["sale_and_trade", "sale_trade", "sale+trade", "both"].includes(listingType);
  const tradeBadgeLabel = isSaleAndTrade
    ? "For Trade"
    : listingType === "trade" || listingType === "trade_only"
      ? "For Trade Only"
      : "";
  const tradeBadgeVariant = tradeBadgeLabel === "For Trade Only" ? " listing-card__trade-badge--only" : "";
  const institution = item.institution || "Institution not provided";
  const institutionLengthClass =
    institution.length > 52
      ? " listing-card__institution--very-long"
      : institution.length > 36
        ? " listing-card__institution--long"
        : "";

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleWishlistClick(e) {
    e.stopPropagation();
    if (!user) return;
    onToggleWishlist?.(item.id);
  }

  function handleModerateClick(e) {
    e.stopPropagation();
    onModerate?.(item);
  }

  return (
    <article
      className="listing-card listing-card--marketplace"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${item.title}`}
    >
      <figure className="listing-card__image-wrap">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
          />
        ) : (
          <figure className="listing-card__image-placeholder" aria-hidden="true">
            <span>{item.emoji}</span>
          </figure>
        )}

        {tradeBadgeLabel && (
          <span
            className={`listing-card__trade-badge${tradeBadgeVariant}${item.status === "flagged" ? " listing-card__trade-badge--stacked" : ""}${isAdmin ? " listing-card__trade-badge--admin-offset" : ""}`}
          >
            {tradeBadgeLabel}
          </span>
        )}

        {item.status === "flagged" && (
          <span className={`listing-card__flagged-badge${isAdmin ? " listing-card__flagged-badge--admin-offset" : ""}`}>
            Flagged
          </span>
        )}

        {isAdmin && (
          <button
            className="listing-card__report-btn listing-card__report-btn--admin-left"
            onClick={handleModerateClick}
            aria-label={`Report ${item.title}`}
            type="button"
          >
            Report
          </button>
        )}

        {onToggleWishlist && (
          <button
            className={`listing-card__wishlist-btn${isWishlisted ? " listing-card__wishlist-btn--active" : ""}`}
            onClick={handleWishlistClick}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={isWishlisted}
            type="button"
            title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
          >
            {isWishlisted ? "♥" : "♡"}
          </button>
        )}
      </figure>

      <section className="listing-card__body">
        <header className="listing-card__header">
          <h3 className="listing-card__title">{item.title}</h3>
          <p
            className="listing-card__badge"
            style={{ background: conditionColor + "22", color: conditionColor }}
          >
            {item.condition}
          </p>
        </header>

        <section className="listing-card__pricing">
          <span className="listing-card__price">
            {item.pricePrefix && (
              <span className="listing-card__price--prefix">{item.pricePrefix} </span>
            )}
            {item.price}
          </span>
          {item.originalPrice && (
            <span className="listing-card__original-price">{item.originalPrice}</span>
          )}
        </section>

        <section className="listing-card__meta">
          {onSellerClick && item.user_id ? (
            <button
              className="listing-card__seller listing-card__seller--link"
              onClick={(e) => {
                e.stopPropagation();
                onSellerClick(item.user_id, item.seller);
              }}
              type="button"
              aria-label={`View profile of ${item.seller}`}
            >
              <span>👤 {item.seller}</span>
              <VerifiedBadge
                compact
                isVerified={item.seller_is_verified}
                verifiedUniversity={item.seller_verified_university}
              />
            </button>
          ) : (
            <p className="listing-card__seller">
              <span>👤 {item.seller}</span>
              <VerifiedBadge
                compact
                isVerified={item.seller_is_verified}
                verifiedUniversity={item.seller_verified_university}
              />
            </p>
          )}
          <p className={`listing-card__institution${institutionLengthClass}`}>🎓 {institution}</p>
        </section>

        {onMessageSeller && (
          <button
            className="listing-card__msg-btn"
            onClick={(e) => {
              e.stopPropagation();
              onMessageSeller(item);
            }}
            aria-label={`Message ${item.seller}`}
            type="button"
          >
            💬 Message Seller
          </button>
        )}
      </section>
    </article>
  );
}
