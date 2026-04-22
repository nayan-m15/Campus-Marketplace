// Main structure for the filter bar feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useEffect, useId, useState } from "react";
import { CATEGORIES, CONDITIONS } from "../data/listings";
import "../styles/FilterBar.css";

export default function FilterBar({
  activeCategory,
  onCategoryChange,
  activeCondition,
  onConditionChange,
  priceSort = "",
  onPriceSortChange,
  priceRange = { min: "", max: "" },
  onPriceRangeChange,
  showSorting = true,
  mobileSorting = false,
}) {
  const [mobilePanel, setMobilePanel] = useState(null);
  // Desktop and mobile share the same filtering state,
  // but mobile opens it in temporary side panels instead of inline controls.
  const supportsSorting = showSorting || mobileSorting;
  const fieldIdBase = useId().replace(/:/g, "");

  const hasActiveFilters =
    activeCategory !== "All Items" ||
    activeCondition !== "All Conditions" ||
    (supportsSorting && priceSort !== "");

  // When a mobile panel is open, lock the page behind it so the panel
  // feels like a real focused task instead of a floating piece of UI.
  useEffect(() => {
    if (!mobilePanel) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event) {
      if (event.key === "Escape") {
        setMobilePanel(null);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobilePanel]);

  // One clear action resets both the filter values and any mobile sort choice.
  function handleClear() {
    onCategoryChange("All Items");
    onConditionChange("All Conditions");
    if (supportsSorting) {
      onPriceSortChange?.("");
      onPriceRangeChange?.({ min: "", max: "" });
    }
  }

  // Desktop still uses a select for sorting.
  // We keep the actual state change in one helper so desktop and mobile
  // both use the same sorting logic.
  function handleSortChange(value) {
    onPriceSortChange?.(value);
    if (value !== "custom") {
      onPriceRangeChange?.({ min: "", max: "" });
    }
  }

  // The same category/condition fields are rendered in two places:
  // inline on desktop, and inside the mobile filter panel.
  function renderFilterFields(prefix) {
    const categoryId = `${fieldIdBase}-${prefix}-category`;
    const conditionId = `${fieldIdBase}-${prefix}-condition`;

    return (
    <>
      <label className="filter-bar__label" htmlFor={categoryId}>
        <span className="filter-bar__label-text">Category</span>
        <select
          id={categoryId}
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

      <label className="filter-bar__label" htmlFor={conditionId}>
        <span className="filter-bar__label-text">Condition</span>
        <select
          id={conditionId}
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
    </>
    );
  }

  // Desktop keeps the classic select dropdown.
  // Mobile gets a button list instead, so people can tap a sort option directly.
  function renderSortFields(prefix, enabled) {
    if (!enabled) return null;

    const sortId = `${fieldIdBase}-${prefix}-price`;
    const minId = `${fieldIdBase}-${prefix}-price-min`;
    const maxId = `${fieldIdBase}-${prefix}-price-max`;

    const sortOptions = [
      { value: "", label: "Any price" },
      { value: "price_asc", label: "Price Low to High" },
      { value: "price_desc", label: "Price High to Low" },
      { value: "condition_asc", label: "Condition Low to High" },
      { value: "condition_desc", label: "Condition High to Low" },
      { value: "newest", label: "Newest Arrivals" },
      { value: "custom", label: "Custom Price Range" },
    ];

    return (
    <>
      {prefix === "mobile" ? (
        <fieldset className="filter-bar__mobile-sort-group">
          <legend className="filter-bar__label-text">Sort By</legend>
          <div className="filter-bar__mobile-sort-options" role="group" aria-label="Sort by">
            {sortOptions.map((option) => (
              <button
                key={option.value || "default"}
                type="button"
                className={`filter-bar__mobile-sort-option${priceSort === option.value ? " filter-bar__mobile-sort-option--active" : ""}`}
                onClick={() => handleSortChange(option.value)}
                aria-pressed={priceSort === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <label className="filter-bar__label" htmlFor={sortId}>
          <span className="filter-bar__label-text">Sort By</span>
          <select
            id={sortId}
            className="filter-bar__select"
            value={priceSort}
            onChange={(e) => handleSortChange(e.target.value)}
          >
            {sortOptions.map((option) => (
              <option key={option.value || "default"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {priceSort === "custom" && (
        <fieldset className="filter-bar__range-fieldset">
          <legend className="filter-bar__range-legend">Price range</legend>

          <label className="filter-bar__range-label" htmlFor={minId}>
            <span className="filter-bar__label-text">Minimum price</span>
            <input
              id={minId}
              type="number"
              min="0"
              placeholder="0"
              value={priceRange.min}
              onChange={(e) =>
                onPriceRangeChange?.({ ...priceRange, min: e.target.value })
              }
              className="filter-bar__range-input"
              aria-label="Minimum price in Rand"
            />
          </label>

          <label className="filter-bar__range-label" htmlFor={maxId}>
            <span className="filter-bar__label-text">Maximum price</span>
            <input
              id={maxId}
              type="number"
              min="0"
              placeholder="Any"
              value={priceRange.max}
              onChange={(e) =>
                onPriceRangeChange?.({ ...priceRange, max: e.target.value })
              }
              className="filter-bar__range-input"
              aria-label="Maximum price in Rand"
            />
          </label>
        </fieldset>
      )}
    </>
    );
  }

  return (
    <nav className="filter-bar" aria-label="Listing filters">
      {/* Mobile gets a compact launcher row instead of showing every control at once.
          That keeps the listing area lighter while still exposing both actions up front. */}
      <div className="filter-bar__mobile-controls" aria-label="Mobile listing controls">
        {mobileSorting && (
          <button
            type="button"
            className={`filter-bar__mobile-trigger${mobilePanel === "sort" ? " filter-bar__mobile-trigger--active" : ""}`}
            onClick={() => setMobilePanel("sort")}
          >
            Sort By
          </button>
        )}
        <button
          type="button"
          className={`filter-bar__mobile-trigger${mobilePanel === "filter" ? " filter-bar__mobile-trigger--active" : ""}`}
          onClick={() => setMobilePanel("filter")}
        >
          Filter
        </button>
      </div>

      {/* This is the desktop / larger-screen version.
          It stays inline so the PC UI can keep the always-visible filter layout. */}
      <fieldset className="filter-bar__fieldset" aria-hidden={mobilePanel ? "true" : undefined}>
        <legend className="filter-bar__legend">Filter listings</legend>

        {renderFilterFields("desktop")}
        {renderSortFields("desktop", showSorting)}

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

      {mobilePanel && (
        // Mobile-only overlay layer:
        // open one task at a time, either filtering or sorting, in a side panel.
        <div className="filter-bar__mobile-layer" role="presentation">
          <button
            type="button"
            className="filter-bar__mobile-backdrop"
            aria-label="Close panel"
            onClick={() => setMobilePanel(null)}
          />

          <section
            className="filter-bar__mobile-panel"
            aria-label={mobilePanel === "filter" ? "Filter listings panel" : "Sort listings panel"}
          >
            <div className="filter-bar__mobile-panel-header">
              <div>
                <p className="filter-bar__mobile-panel-eyebrow">
                  {mobilePanel === "filter" ? "Listings" : "Ordering"}
                </p>
                <h2 className="filter-bar__mobile-panel-title">
                  {mobilePanel === "filter" ? "Filter" : "Sort By"}
                </h2>
              </div>
              <button
                type="button"
                className="filter-bar__mobile-close"
                aria-label="Close panel"
                onClick={() => setMobilePanel(null)}
              >
                ×
              </button>
            </div>

            <div className="filter-bar__mobile-panel-body">
              {mobilePanel === "filter"
                ? renderFilterFields("mobile")
                : renderSortFields("mobile", mobileSorting)}
            </div>

            <div className="filter-bar__mobile-panel-actions">
              {hasActiveFilters && (
                <button
                  type="button"
                  className="filter-bar__clear filter-bar__clear--mobile"
                  onClick={() => {
                    handleClear();
                    setMobilePanel(null);
                  }}
                >
                  Clear filters
                </button>
              )}

              <button
                type="button"
                className="filter-bar__apply"
                onClick={() => setMobilePanel(null)}
              >
                Apply
              </button>
            </div>
          </section>
        </div>
      )}
    </nav>
  );
}
