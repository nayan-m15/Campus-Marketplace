import "../styles/Navbar.css";

export default function Navbar({ searchQuery, onSearchChange, user, onLogin, onSignup, onSignOut }) {
  // Pull a display name from the user object (Google gives display_name, email fallback)
  const displayName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split("@")[0]
    || "Profile";

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
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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

      {/* Navigation */}
      <nav aria-label="User navigation">
        <ul className="navbar__links">
          {user ? (
            // ── Logged-in state ──────────────────────────────
            <>
              <li>
                <button className="navbar__link">
                  Messages
                </button>
              </li>
              <li>
                <button className="navbar__link navbar__link--user" title={user.email}>
                  👤 {displayName}
                </button>
              </li>
              <li>
                <button className="navbar__link" onClick={onSignOut}>
                  Sign Out
                </button>
              </li>
              <li>
                <button className="btn-primary navbar__list-btn">
                  <span>+</span> List Item
                </button>
              </li>
            </>
          ) : (
            // ── Logged-out state ─────────────────────────────
            <>
              <li>
                <button className="navbar__link" onClick={onLogin}>
                  Log In
                </button>
              </li>
              <li>
                <button className="btn-primary navbar__list-btn" onClick={onSignup}>
                  Sign Up Free
                </button>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}
