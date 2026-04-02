import { CATEGORIES } from "../data/listings";
import "../styles/CategoryBar.css";

export default function CategoryBar({ activeCategory, onCategoryChange }) {
  return (
    <nav className="category-bar" aria-label="Category navigation">
      <ul className="category-bar__inner">
        {CATEGORIES.map((cat) => (
          <li key={cat.label}>
            <button
              className={`category-bar__pill${
                activeCategory === cat.label
                  ? " category-bar__pill--active"
                  : ""
              }`}
              onClick={() => onCategoryChange(cat.label)}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
