import { CATEGORIES, CONDITIONS } from "../data/listings";
import "../styles/FilterBar.css";

export default function FilterBar({
  activeCategory,
  onCategoryChange,
  activeCondition,
  onConditionChange,
  priceSort,
  onPriceSortChange,
  priceRange,
  onPriceRangeChange,
}) {
  const hasActiveFilters =
    activeCategory !== "All Items" ||
    activeCondition !== "All Conditions" ||
    priceSort !== "";

  function handleClear() {
    onCategoryChange("All Items");
    onConditionChange("All Conditions");
    onPriceSortChange("");
    onPriceRangeChange({ min: "", max: "" });
  }

  return (
    <nav className="filter-bar" aria-label="Listing filters">
      <fieldset className="filter-bar__fieldset">
        <legend className="filter-bar__legend">Filter listings</legend>

        {/* ── Category ── */}
        <label className="filter-bar__label" htmlFor="filter-category">
          <span className="filter-bar__label-text">Category</span>
          <select
            id="filter-category"
            className="filter-bar__select"
            value={activeCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.label} value={cat.label}>
                {cat.emoji} {cat.label}
              </option>
            ))}
          </select>
        </label>

        {/* ── Condition ── */}
        <label className="filter-bar__label" htmlFor="filter-condition">
          <span className="filter-bar__label-text">Condition</span>
          <select
            id="filter-condition"
            className="filter-bar__select"
            value={activeCondition}
            onChange={(e) => onConditionChange(e.target.value)}
          >
            {CONDITIONS.map((cond) => (
              <option key={cond} value={cond}>
                {cond}
              </option>
            ))}
          </select>
        </label>

        {/* ── Price ── */}
        <label className="filter-bar__label" htmlFor="filter-price">
          <span className="filter-bar__label-text">Price</span>
          <select
            id="filter-price"
            className="filter-bar__select"
            value={priceSort}
            onChange={(e) => {
              onPriceSortChange(e.target.value);
              if (e.target.value !== "custom") {
                onPriceRangeChange({ min: "", max: "" });
              }
            }}
          >
            <option value="">Any price</option>
            <option value="asc">Low → High</option>
            <option value="desc">High → Low</option>
            <option value="custom">Custom range</option>
          </select>
        </label>

        {/* ── Custom price range (shown only when selected) ── */}
        {priceSort === "custom" && (
          <fieldset className="filter-bar__range-fieldset">
            <legend className="filter-bar__range-legend">Price range (R)</legend>

            <label className="filter-bar__range-label" htmlFor="price-min">
              <span className="filter-bar__label-text">Min</span>
              <input
                id="price-min"
                type="number"
                min="0"
                placeholder="0"
                value={priceRange.min}
                onChange={(e) =>
                  onPriceRangeChange({ ...priceRange, min: e.target.value })
                }
                className="filter-bar__range-input"
                aria-label="Minimum price in Rand"
              />
            </label>

            <span className="filter-bar__range-sep" aria-hidden="true">–</span>

            <label className="filter-bar__range-label" htmlFor="price-max">
              <span className="filter-bar__label-text">Max</span>
              <input
                id="price-max"
                type="number"
                min="0"
                placeholder="Any"
                value={priceRange.max}
                onChange={(e) =>
                  onPriceRangeChange({ ...priceRange, max: e.target.value })
                }
                className="filter-bar__range-input"
                aria-label="Maximum price in Rand"
              />
            </label>
          </fieldset>
        )}

        {/* ── Clear ── */}
        {hasActiveFilters && (
          <button
            type="button"
            className="filter-bar__clear"
            onClick={handleClear}
          >
            Clear filters
          </button>
        )}
      </fieldset>
    </nav>
  );
}