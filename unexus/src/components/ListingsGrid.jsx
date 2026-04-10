import ListingCard from "./ListingCard";
import "../styles/ListingCard.css";

export default function ListingsGrid({
  listings = [],
  searchQuery = "",
  activeCategory = "All Items",
  onListingClick,
  onMessageSeller,
  onSellerClick,
}) {
  const heading = searchQuery.trim()
    ? `Results for "${searchQuery.trim()}"`
    : activeCategory;

  return (
    <section style={{ padding: "36px 40px", maxWidth: 1280, margin: "0 auto" }}>
      <header style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--gray-900)",
            letterSpacing: "-0.5px",
          }}
        >
          {heading}
        </h2>
        <p style={{ color: "var(--gray-600)", fontSize: 14, marginTop: 4 }}>
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
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
