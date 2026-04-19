// Main structure for the listings grid feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import ListingCard from "./ListingCard";
import "../styles/ListingCard.css";

// Component entry point for this part of the interface.
// Rendering and feature-specific behavior are coordinated here.
export default function ListingsGrid({
  listings = [],
  searchQuery = "",
  activeCategory = "All Items",
  priceSort = "",
  onPriceSortChange,
  priceRange = { min: "", max: "" },
  onPriceRangeChange,
  onListingClick,
  onMessageSeller,
  onSellerClick,
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
        <div className="listings-section__heading-block">
          <h2 className="listings-section__title">{heading}</h2>
          <p className="listings-section__count">
            {listings.length} item{listings.length !== 1 ? "s" : ""} available near you
          </p>
        </div>

        <div className="listings-section__sort-area">
          <label className="listings-section__sort-label" htmlFor="listings-sort">
            <span className="listings-section__sort-text">Sort by</span>
            <select
              id="listings-sort"
              className="listings-section__sort-select"
              value={priceSort}
              onChange={(e) => {
                onPriceSortChange?.(e.target.value);
                if (e.target.value !== "custom") {
                  onPriceRangeChange?.({ min: "", max: "" });
                }
              }}
            >
              <option value="">Any price</option>
              <option value="price_asc">Price Low to High</option>
              <option value="price_desc">Price High to Low</option>
              <option value="condition_asc">Condition Low to High</option>
              <option value="condition_desc">Condition High to Low</option>
              <option value="newest">Newest Arrivals</option>
              <option value="custom">Custom Price Range</option>
            </select>
          </label>

          {priceSort === "custom" && (
            <fieldset className="listings-section__range-fieldset">
              <legend className="listings-section__range-legend">Price range</legend>

              <label className="listings-section__range-label" htmlFor="listings-price-min">
                <span className="listings-section__range-text">Min</span>
                <input
                  id="listings-price-min"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={priceRange.min}
                  onChange={(e) =>
                    onPriceRangeChange?.({ ...priceRange, min: e.target.value })
                  }
                  className="listings-section__range-input"
                  aria-label="Minimum price in Rand"
                />
              </label>

              <label className="listings-section__range-label" htmlFor="listings-price-max">
                <span className="listings-section__range-text">Max</span>
                <input
                  id="listings-price-max"
                  type="number"
                  min="0"
                  placeholder="Any"
                  value={priceRange.max}
                  onChange={(e) =>
                    onPriceRangeChange?.({ ...priceRange, max: e.target.value })
                  }
                  className="listings-section__range-input"
                  aria-label="Maximum price in Rand"
                />
              </label>
            </fieldset>
          )}
        </div>
      </header>

      {listings.length === 0 ? (
        <section className="listings-empty" aria-live="polite">
          <p className="listings-empty__icon" aria-hidden="true">...</p>
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
