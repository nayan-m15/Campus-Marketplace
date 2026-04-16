import "../styles/WishlistPage.css";
import { CONDITION_COLORS } from "../data/listings";

export default function WishlistPage({
  wishlistItems = [],
  loading = false,
  onListingClick,
  onToggleWishlist,
}) {
  if (loading) {
    return (
      <main className="wl__wrapper">
        <div className="wl__loading">
          <span className="wl__spinner" />
          <p>Loading your wishlist…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="wl__wrapper">
      <header className="wl__header">
        <h1 className="wl__title">My Wishlist</h1>
        <p className="wl__subtitle">
          {wishlistItems.length === 0
            ? "Nothing saved yet — heart an item to save it here."
            : `${wishlistItems.length} saved item${wishlistItems.length !== 1 ? "s" : ""}`}
        </p>
      </header>

      {wishlistItems.length === 0 ? (
        <section className="wl__empty">
          <span className="wl__empty-icon">🤍</span>
          <h2 className="wl__empty-title">Your wishlist is empty</h2>
          <p className="wl__empty-sub">
            Tap the heart icon on any listing to save it for later.
          </p>
        </section>
      ) : (
        <ul className="wl__grid">
          {wishlistItems.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              onClick={() => onListingClick?.(item)}
              onRemove={() => onToggleWishlist?.(item.id)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function WishlistCard({ item, onClick, onRemove }) {
  const conditionColor = CONDITION_COLORS[item.condition] || "#6b7280";

  return (
    <li className="wl__card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
      aria-label={`Open ${item.title}`}
    >
      <figure className="wl__img-wrap">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="wl__img" />
        ) : (
          <div className="wl__img-placeholder">📦</div>
        )}
        {/* Remove from wishlist button */}
        <button
          className="wl__remove-btn"
          aria-label="Remove from wishlist"
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          title="Remove from wishlist"
        >
          ♥
        </button>
      </figure>

      <section className="wl__card-body">
        <h3 className="wl__card-title">{item.title}</h3>
        <div className="wl__card-meta">
          <span
            className="wl__condition"
            style={{ background: conditionColor + "22", color: conditionColor }}
          >
            {item.condition}
          </span>
          <span className="wl__price">R {item.price}</span>
        </div>
      </section>
    </li>
  );
}
