import "../styles/Navbar.css";

export default function Navbar({ searchQuery, onSearchChange }) {
  return (
    <header className="navbar">
      {/* Logo */}
      <section className="navbar__logo" aria-label="Homepage">
        <strong className="navbar__logo-icon">UX</strong>
        <span className="navbar__logo-text">Unexus</span>
      </section>

      {/* Search */}
      <form
        className="navbar__search"
        role="search"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="navbar__search-icon" aria-hidden="true">
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </label>
        <input
          type="search"
          placeholder="Search textbooks, electronics, furniture..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </form>

      {/* Navigation Links */}
      <nav aria-label="User navigation">
        <ul className="navbar__links">
          {[
            { icon: "", label: "Messages" },
            { icon: "", label: "Login" },
            { icon: "", label: "Profile" },
          ].map((link) => (
            <li key={link.label}>
              <button className="navbar__link">
                <span>{link.icon}</span>
                {link.label}
              </button>
            </li>
          ))}

          <li>
            <button className="btn-primary navbar__list-btn">
              <span>+</span> List Item
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}
