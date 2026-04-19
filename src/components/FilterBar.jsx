import { CATEGORIES, CONDITIONS } from "../data/listings";
import "../styles/FilterBar.css";

export default function FilterBar({
  activeCategory,
  onCategoryChange,
  activeCondition,
  onConditionChange,
}) {
  const hasActiveFilters =
    activeCategory !== "All Items" ||
    activeCondition !== "All Conditions";

  function handleClear() {
    onCategoryChange("All Items");
    onConditionChange("All Conditions");
  }

  return (
    <nav className="filter-bar" aria-label="Listing filters">
      <fieldset className="filter-bar__fieldset">
        <legend className="filter-bar__legend">Filter listings</legend>

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
