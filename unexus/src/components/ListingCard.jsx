import { CONDITION_COLORS } from "../data/listings";
import "../styles/ListingCard.css";

function StarRating({ rating = 0, count }) {
  const totalStars = 5;
  const stars = [];

  for (let i = 1; i <= totalStars; i++) {
    if (rating >= i) {
      stars.push(
        <li key={i} className="listing-card__star listing-card__star--filled">★</li>
      );
    } else if (rating >= i - 0.75) {
      stars.push(
        <li key={i} className="listing-card__star listing-card__star--half">★</li>
      );
    } else {
      stars.push(
        <li key={i} className="listing-card__star">★</li>
      );
    }
  }

  return (
    <section className="listing-card__rating" aria-label={`${rating} out of 5 stars`}>
      <ul className="listing-card__stars">
        {stars}
      </ul>
      {count != null && (
        <span className="listing-card__review-count">({count})</span>
      )}
    </section>
  );
}

export default function ListingCard({ item }) {
  const conditionColor = CONDITION_COLORS[item.condition] || "#6b7280";

  return (
    <article className="listing-card">
      {/* ── Image Area ── */}
      <figure className="listing-card__image-wrap">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} />
        ) : (
          <figure className="listing-card__image-placeholder" aria-hidden="true">
            <span>{item.emoji}</span>
          </figure>
        )}
      </figure>

      {/* ── Card Body ── */}
      <section className="listing-card__body">
        {/* Title + Condition Badge */}
        <header className="listing-card__header">
          <h3 className="listing-card__title">{item.title}</h3>
          <p
            className="listing-card__badge"
            style={{
              background: conditionColor + "22",
              color: conditionColor,
            }}
          >
            {item.condition}
          </p>
        </header>

        {/* Pricing */}
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

        {/* Seller & Distance */}
        <section className="listing-card__meta">
          <p className="listing-card__seller">👤 {item.seller}</p>
          <p className="listing-card__distance">📍 {item.distance}</p>
        </section>

        {/* Star rating */}
        <StarRating rating={item.rating ?? 0} count={item.reviewCount} />
      </section>
    </article>
  );
}
