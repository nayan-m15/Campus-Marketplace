import { useMemo, useState } from "react";
import ListingCard from "./ListingCard";
import { CATEGORIES, CONDITIONS } from "../data/listings";

function numericPrice(item) {
  if (!item?.price) return 0;
  const value = parseFloat(String(item.price).replace(/[^0-9.]/g, ""));
  return Number.isNaN(value) ? 0 : value;
}

function formatListingDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function AdminModerateListingsPanel({
  listings = [],
  loading = false,
  error = "",
  onModerateListing,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [activeCondition, setActiveCondition] = useState("All Conditions");
  const [priceSort, setPriceSort] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });

  const filteredListings = useMemo(() => {
    let result = listings.filter((item) => {
      const searchMatch = searchQuery.trim()
        ? (item.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.category || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.seller || "").toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const categoryMatch =
        searchQuery.trim() || activeCategory === "All Items"
          ? true
          : item.category === activeCategory;

      const conditionMatch =
        activeCondition === "All Conditions" || item.condition === activeCondition;

      const minOk =
        priceSort !== "custom" ||
        priceRange.min === "" ||
        numericPrice(item) >= Number(priceRange.min);

      const maxOk =
        priceSort !== "custom" ||
        priceRange.max === "" ||
        numericPrice(item) <= Number(priceRange.max);

      return searchMatch && categoryMatch && conditionMatch && minOk && maxOk;
    });

    if (priceSort === "price_asc") result = [...result].sort((a, b) => numericPrice(a) - numericPrice(b));
    if (priceSort === "price_desc") result = [...result].sort((a, b) => numericPrice(b) - numericPrice(a));
    if (priceSort === "condition_asc") result = [...result].sort((a, b) => CONDITIONS.indexOf(b.condition) - CONDITIONS.indexOf(a.condition));
    if (priceSort === "condition_desc") result = [...result].sort((a, b) => CONDITIONS.indexOf(a.condition) - CONDITIONS.indexOf(b.condition));
    if (priceSort === "newest") result = [...result].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return result;
  }, [activeCategory, activeCondition, listings, priceRange, priceSort, searchQuery]);

  const flaggedCount = listings.filter((item) => item.status === "flagged").length;
  const tradeCount = listings.filter((item) =>
    item.listing_type === "trade" || item.listing_type === "sale_and_trade" || item.status === "for_trade"
  ).length;

  return (
    <section className="panel" aria-labelledby="moderate-listings-heading">
      <header className="panel__header">
        <hgroup>
          <h2 id="moderate-listings-heading" className="panel__title">Moderate Listings</h2>
          <p className="panel__subtitle">
            Review marketplace listings, inspect flagged activity, and apply the existing moderation actions.
          </p>
        </hgroup>
      </header>

      <section className="moderation-toolbar" aria-label="Moderation filters">
        <div className="moderation-toolbar__stats">
          <article className="moderation-stat-card">
            <span className="moderation-stat-card__label">Total listings</span>
            <strong className="moderation-stat-card__value">{listings.length}</strong>
          </article>
          <article className="moderation-stat-card">
            <span className="moderation-stat-card__label">Flagged</span>
            <strong className="moderation-stat-card__value">{flaggedCount}</strong>
          </article>
          <article className="moderation-stat-card">
            <span className="moderation-stat-card__label">Trade listings</span>
            <strong className="moderation-stat-card__value">{tradeCount}</strong>
          </article>
        </div>

        <div className="moderation-toolbar__filters">
          <label className="moderation-field">
            <span className="moderation-field__label">Search</span>
            <input
              className="field-input"
              type="search"
              placeholder="Title, seller, or category"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <label className="moderation-field">
            <span className="moderation-field__label">Category</span>
            <select
              className="field-select"
              value={activeCategory}
              onChange={(event) => setActiveCategory(event.target.value)}
            >
              {CATEGORIES.map((category) => (
                <option key={category.label} value={category.label}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="moderation-field">
            <span className="moderation-field__label">Condition</span>
            <select
              className="field-select"
              value={activeCondition}
              onChange={(event) => setActiveCondition(event.target.value)}
            >
              {CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>
          </label>

          <label className="moderation-field">
            <span className="moderation-field__label">Sort by</span>
            <select
              className="field-select"
              value={priceSort}
              onChange={(event) => {
                setPriceSort(event.target.value);
                if (event.target.value !== "custom") {
                  setPriceRange({ min: "", max: "" });
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
            <>
              <label className="moderation-field">
                <span className="moderation-field__label">Min price</span>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={priceRange.min}
                  onChange={(event) => setPriceRange((current) => ({ ...current, min: event.target.value }))}
                />
              </label>

              <label className="moderation-field">
                <span className="moderation-field__label">Max price</span>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  placeholder="Any"
                  value={priceRange.max}
                  onChange={(event) => setPriceRange((current) => ({ ...current, max: event.target.value }))}
                />
              </label>
            </>
          )}
        </div>
      </section>

      {error ? (
        <p className="moderation-feedback moderation-feedback--error" role="alert">{error}</p>
      ) : loading ? (
        <section className="moderation-empty" aria-live="polite">
          <p className="moderation-empty__icon" aria-hidden="true">...</p>
          <h3 className="moderation-empty__title">Loading listings</h3>
          <p className="moderation-empty__subtitle">Pulling the latest marketplace inventory for moderation.</p>
        </section>
      ) : filteredListings.length === 0 ? (
        <section className="moderation-empty" aria-live="polite">
          <p className="moderation-empty__icon" aria-hidden="true">...</p>
          <h3 className="moderation-empty__title">No listings match these filters</h3>
          <p className="moderation-empty__subtitle">Try widening your search or clearing one of the moderation filters.</p>
        </section>
      ) : (
        <ul className="moderation-grid" role="list">
          {filteredListings.map((item) => (
            <li key={item.id}>
              <article className="moderation-card">
                <ListingCard
                  item={item}
                  isAdmin
                  onModerate={onModerateListing}
                  onClick={() => onModerateListing?.(item)}
                />

                <section className="moderation-card__details">
                  <div className="moderation-card__badges">
                    <span className={`moderation-status moderation-status--${item.status === "flagged" ? "flagged" : "active"}`}>
                      {item.status === "flagged" ? "Flagged" : "Active"}
                    </span>
                    <span className="moderation-pill">{item.category}</span>
                    <span className="moderation-pill">
                      {item.listing_type === "trade"
                        ? "Trade"
                        : item.listing_type === "sale_and_trade" || item.status === "for_trade"
                          ? "Sale & Trade"
                          : "Sale"}
                    </span>
                  </div>

                  <dl className="moderation-card__meta">
                    <div>
                      <dt>Seller</dt>
                      <dd>{item.seller || "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Institution</dt>
                      <dd>{item.institution || "Institution not provided"}</dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>{item.approximate_location || "Location not provided"}</dd>
                    </div>
                    <div>
                      <dt>Joined</dt>
                      <dd>{item.joined_label || "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Listed</dt>
                      <dd>{formatListingDate(item.created_at)}</dd>
                    </div>
                  </dl>

                  <div className="moderation-card__reason">
                    <span className="moderation-card__reason-label">Moderation note</span>
                    <p>{item.flag_reason?.trim() || "No moderation note has been added yet."}</p>
                  </div>

                  <button
                    className="btn-export moderation-card__action"
                    type="button"
                    onClick={() => onModerateListing?.(item)}
                  >
                    Review moderation
                  </button>
                </section>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
