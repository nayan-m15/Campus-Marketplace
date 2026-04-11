import { useState } from "react";
import "../styles/Navbar.css";

export default function Navbar({
  searchQuery,
  onSearchChange,
  user,
  avatarUrl,
  profileName,
  onLogin,
  onSignup,
  onSignOut,
  onShowListingForm,
  onProfile,
  onMessages,
  onHome,
  onYourListings,
  onWishlist,          // ← NEW prop
  wishlistCount = 0,   // ← NEW prop (optional badge)
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName =
    profileName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Profile";

  return (
    <header className="navbar">

      {/* Logo */}
      <button className="navbar__logo" aria-label="Go to homepage" onClick={onHome}>
        <strong className="navbar__logo-icon">
          <img src="/favicon.png" alt="UX Logo" className="navbar__logo-img" />
        </strong>
        <span className="navbar__logo-text">Unexus</span>
      </button>

      {/* Search */}
      <form className="navbar__search" role="search" onSubmit={(e) => e.preventDefault()}>
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

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>

        <nav aria-label="User navigation">
          <ul className="navbar__links">
            {user ? (
              <>
                <li>
                  <button className="navbar__link" onClick={onMessages}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Messages
                  </button>
                </li>
                <li>
                  <button className="navbar__link navbar__link--user" title={user.email} onClick={onProfile}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <span>👤</span>
                    )}
                    {displayName}
                  </button>
                </li>
                <li><button className="navbar__link" onClick={onSignOut}>Sign Out</button></li>
                <li>
                  <button className="btn-primary navbar__list-btn" onClick={onShowListingForm}>
                    <span>+</span> List Item
                  </button>
                </li>
              </>
            ) : (
              <>
                <li><button className="navbar__link" onClick={onLogin}>Log In</button></li>
                <li>
                  <button className="btn-primary navbar__list-btn" onClick={onSignup}>
                    Sign Up Free
                  </button>
                </li>
              </>
            )}
          </ul>
        </nav>

        {/* Hamburger */}
        <div className="navbar__hamburger-wrap">
          <button
            className="navbar__hamburger"
            aria-label="Open menu"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span /><span /><span />
          </button>

          {menuOpen && (
            <>
              <div className="navbar__menu-backdrop" onClick={() => setMenuOpen(false)} />
              <nav className="navbar__menu" aria-label="Side menu">
                <ul>
                  <li>
                    <button onClick={() => { onProfile?.(); setMenuOpen(false); }}>
                      Profile
                    </button>
                  </li>
                  <li>
                    <button onClick={() => { onYourListings?.(); setMenuOpen(false); }}>
                      Your Listings
                    </button>
                  </li>

                  {/* ── Wishlist entry with optional count badge ── */}
                  <li>
                    <button
                      onClick={() => { onWishlist?.(); setMenuOpen(false); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                    >
                      <span>Wishlist</span>
                      {wishlistCount > 0 && (
                        <span style={{
                          background: "#e74c3c",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 20,
                          padding: "1px 7px",
                          minWidth: 20,
                          textAlign: "center",
                        }}>
                          {wishlistCount}
                        </span>
                      )}
                    </button>
                  </li>

                  <li>
                    <button onClick={() => { setMenuOpen(false); }}>
                      Settings
                    </button>
                  </li>
                  {user && (
                    <li>
                      <button onClick={() => { onSignOut?.(); setMenuOpen(false); }}>
                        Sign Out
                      </button>
                    </li>
                  )}
                </ul>
              </nav>
            </>
          )}
        </div>

      </div>

    </header>
  );
}
