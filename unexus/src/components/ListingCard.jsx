import { CONDITION_COLORS } from "../data/listings";
import "../styles/ListingCard.css";

export default function ListingCard({ item }) {
  const conditionColor = CONDITION_COLORS[item.condition] || "#6b7280";

  return (
    <article className="listing-card">
      {/* Image / Emoji Preview */}
      <figure className="listing-card__image" aria-label="Item preview">
        <span>{item.emoji}</span>
      </figure>

      {/* Card Body */}
      <section className="listing-card__body">
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

        <p className="listing-card__price">{item.price}</p>

        <section className="listing-card__meta" aria-label="Listing details">
          <p className="listing-card__seller">👤 {item.seller}</p>
          <p className="listing-card__distance">📍 {item.distance}</p>
        </section>

        <footer>
          <button className="btn-primary listing-card__btn">
            View Item
          </button>
        </footer>
      </section>
    </article>
  );
}
