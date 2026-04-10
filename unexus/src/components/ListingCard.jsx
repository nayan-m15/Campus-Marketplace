import { CONDITION_COLORS } from "../data/listings";
import "../styles/ListingCard.css";

function StarRating({ rating = 0, count }) {
  const totalStars = 5;
  const stars = [];

  for (let i = 1; i <= totalStars; i++) {
    if (rating >= i) {
      stars.push(
        <li key={i} className="listing-card__star listing-card__star--filled">
          ★
        </li>
      );
    } else if (rating >= i - 0.75) {
      stars.push(
        <li key={i} className="listing-card__star listing-card__star--half">
          ★
        </li>
      );
    } else {
      stars.push(
        <li key={i} className="listing-card__star">
          ★
        </li>
      );
    }
  }

  return (
    <section
      className="listing-card__rating"
      aria-label={`${rating} out of 5 stars`}
    >
      <ul className="listing-card__stars">{stars}</ul>
      {count != null && (
        <span className="listing-card__review-count">({count})</span>
      )}
    </section>
  );
}

export default function ListingCard({ item, onClick, onMessageSeller, onSellerClick }) {
  const conditionColor = CONDITION_COLORS[item.condition] || "#6b7280";

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  }

  return (
    <article
      className="listing-card"
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
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <figure
            className="listing-card__image-placeholder"
            aria-hidden="true"
          >
            <span>{item.emoji}</span>
          </figure>
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
              <span className="listing-card__price--prefix">
                {item.pricePrefix}{" "}
              </span>
            )}
            {item.price}
          </span>

          {item.originalPrice && (
            <span className="listing-card__original-price">
              {item.originalPrice}
            </span>
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
              👤 {item.seller}
            </button>
          ) : (
            <p className="listing-card__seller">👤 {item.seller}</p>
          )}
          <p className="listing-card__distance">📍 {item.distance}</p>
        </section>

        <StarRating rating={item.rating ?? 0} count={item.reviewCount} />

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
