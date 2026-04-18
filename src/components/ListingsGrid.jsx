import ListingCard from "./ListingCard";
import "../styles/ListingCard.css";

export default function ListingsGrid({
  listings = [],
  searchQuery = "",
  activeCategory = "All Items",
  onListingClick,
  onMessageSeller,
  onSellerClick,
  // Wishlist props
  isWishlisted,
  onToggleWishlist,
  user,
}) {
  const heading = searchQuery.trim()
    ? `Results for "${searchQuery.trim()}"`
    : activeCategory;

  return (
    <section className="listings-section">
      <header className="listings-section__header">
        <h2 className="listings-section__title">{heading}</h2>
        <p className="listings-section__count">
          ↗ {listings.length} item{listings.length !== 1 ? "s" : ""} available near you
        </p>
      </header>

      {listings.length === 0 ? (
        <section className="listings-empty" aria-live="polite">
          <p className="listings-empty__icon">🔍</p>
          <h3 className="listings-empty__title">No listings yet</h3>
          <p className="listings-empty__subtitle">
            Be the first to list something in this category!
          </p>
          <button className="btn-primary" type="button">
            + List an Item
          </button>
        </section>
      ) : (
        <ul className="listings-grid">
          {listings.map((item) => (
            <li key={item.id}>
              <ListingCard
                item={item}
                onClick={() => onListingClick?.({ ...item })}
                onMessageSeller={onMessageSeller}
                onSellerClick={onSellerClick}
                isWishlisted={isWishlisted?.(item.id) ?? false}
                onToggleWishlist={onToggleWishlist}
                user={user}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
