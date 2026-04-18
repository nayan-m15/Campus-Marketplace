import { useState } from "react";
import "../styles/Navbar.css";

export default function Navbar({
  searchQuery,
  onSearchChange,
  onSearchFocus,
  user,
  avatarUrl,
  profile,
  profileName,
  onLogin,
  onSignup,
  onSignOut,
  onShowListingForm,
  onProfile,
  onMessages,
  onHome,
  onYourListings,
  onWishlist,
  wishlistCount = 0,
  unreadCount = 0,
  onSettings,      // ← NEW: total unread message count
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const displayName =
    profile?.display_name ||
    profile?.name ||
    profileName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Profile";

  return (
    <>
    <div className="navbar-spacer" aria-hidden="true" />
    <header className={`navbar${searchOpen ? " navbar--mobile-search-open" : ""}`}>

      {/* Logo */}
      <button className="navbar__logo" aria-label="Go to homepage" onClick={() => { onHome?.(); setMenuOpen(false); setSearchOpen(false); }}>
        <strong className="navbar__logo-icon">
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="UX Logo" className="navbar__logo-img" />
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
          onFocus={onSearchFocus}
          onClick={onSearchFocus}
        />
      </form>

      {/* Right side */}
      <div className="navbar__actions">
        <div className="navbar__mobile-actions" aria-label="Quick actions">
          <button
            className="navbar__icon-btn"
            type="button"
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((prev) => !prev)}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          {user && (
            <>
              <button className="navbar__icon-btn" onClick={() => { onMessages?.(); setSearchOpen(false); }} type="button" aria-label="Open messages">
                <span className="navbar__icon-btn-wrap">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="navbar__mobile-badge">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
              </button>

              <button className="navbar__icon-btn navbar__icon-btn--profile" title={user.email} onClick={() => { onProfile?.(); setSearchOpen(false); }} type="button" aria-label="Open profile">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="navbar__mobile-avatar" />
                ) : (
                  <span className="navbar__mobile-avatar navbar__mobile-avatar--placeholder">P</span>
                )}
              </button>

              <button className="navbar__icon-btn navbar__icon-btn--plus" onClick={() => { onShowListingForm?.(); setSearchOpen(false); }} type="button" aria-label="List item">
                <span aria-hidden="true">+</span>
              </button>
            </>
          )}
        </div>

        <nav aria-label="User navigation">
          <ul className="navbar__links">
            {user ? (
              <>
                <li>
                  {/* ── Messages button with Instagram-style unread bubble ── */}
                  <button className="navbar__link" onClick={onMessages} style={{ position: "relative" }}>
                    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {unreadCount > 0 && (
                        <span style={{
                          position: "absolute",
                          top: -6,
                          right: -7,
                          background: "#53d769",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          lineHeight: 1,
                          borderRadius: "50%",
                          minWidth: 16,
                          height: 16,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 3px",
                          boxShadow: "0 0 0 2px var(--gray-900, #1a1a1a)",
                          pointerEvents: "none",
                        }}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </span>
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
            onClick={() => {
              setSearchOpen(false);
              setMenuOpen((prev) => !prev);
            }}
          >
            <span /><span /><span />
          </button>

          {menuOpen && (
            <>
              <div className="navbar__menu-backdrop" onClick={() => setMenuOpen(false)} />
              <nav className="navbar__menu" aria-label="Side menu">
                <ul>
                  {user && (
                    <>
                      <li>
                        <button onClick={() => { onMessages?.(); setMenuOpen(false); }}>
                          Messages
                        </button>
                      </li>
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
                              background: "#166534",
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
                    </>
                  )}

                  {!user && (
                    <>
                      <li>
                        <button onClick={() => { onLogin?.(); setMenuOpen(false); }}>
                          Log In
                        </button>
                      </li>
                      <li>
                        <button onClick={() => { onSignup?.(); setMenuOpen(false); }}>
                          Sign Up
                        </button>
                      </li>
                    </>
                  )}

                  <li>
                    <button onClick={() => { onSettings?.(); setMenuOpen(false); }}>
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
    </>
  );
}
