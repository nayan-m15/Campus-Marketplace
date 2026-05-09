import { useEffect, useRef, useState } from "react";
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
  onBookings,
  onWishlist,
  wishlistCount = 0,
  unreadCount = 0,
  onSettings,
  onAdminDashboard,
  isAdmin = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // This lets us tell whether a tap happened inside the navbar
  // or somewhere else on the page while mobile search is open.
  const headerRef = useRef(null);
  // We only need this ref for the mobile overlay search.
  // When the overlay opens, focus should land in the field immediately.
  const mobileSearchInputRef = useRef(null);

  // Keep the profile label friendly by preferring a saved display name first,
  // then falling back through the other user/profile values we might have.
  const displayName =
    profile?.display_name ||
    profile?.name ||
    profileName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Profile";

  // The search overlay behaves like a temporary mobile-only navbar.
  // Auto-focusing the input makes the interaction feel deliberate.
  useEffect(() => {
    if (searchOpen) {
      mobileSearchInputRef.current?.focus();
    }
  }, [searchOpen]);

  // Mobile search should behave like a temporary overlay.
  // If someone taps anywhere outside the navbar, close it and bring back the normal nav.
  useEffect(() => {
    if (!searchOpen) return undefined;

    function handlePointerDown(event) {
      if (!headerRef.current?.contains(event.target)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [searchOpen]);

  // Shared fallback avatar so the no-photo state looks intentional
  // on both desktop and mobile instead of each view inventing its own version.
  const renderFallbackAvatar = (className) => (
    <span className={className} aria-hidden="true">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
      </svg>
    </span>
  );

  // This is the shared search field markup used by the mobile overlay.
  // Desktop keeps its own inline version below so the desktop layout stays separate.
  const searchField = (
    <>
      <label className="navbar__search-icon" aria-hidden="true">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </label>
      <input
        ref={mobileSearchInputRef}
        type="search"
        placeholder="Search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={onSearchFocus}
        onClick={onSearchFocus}
      />
    </>
  );

  return (
    <>
      {/* Keeps page content from sliding under the fixed navbar. */}
      <div className="navbar-spacer" aria-hidden="true" />
      <header
        ref={headerRef}
        className={`navbar${searchOpen ? " navbar--mobile-search-open" : ""}${!user ? " navbar--logged-out" : ""}`}
      >
        {searchOpen ? (
          // Mobile-only search state:
          // when search is open, we swap out the normal compact mobile navbar
          // for a dedicated overlay row with the full search field and close button.
          <div className="navbar__mobile-search-shell">
            <form className="navbar__search navbar__search--mobile-overlay" role="search" onSubmit={(e) => e.preventDefault()}>
              {searchField}
            </form>
            <button
              className="navbar__search-close"
              type="button"
              aria-label="Close search"
              onClick={() => setSearchOpen(false)}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            {/* Shared brand button.
                The text is hidden by CSS on mobile, so desktop keeps the full brand
                while mobile only shows the logo. */}
            <button
              className="navbar__logo"
              aria-label="Go to homepage"
              onClick={() => {
                onHome?.();
                setMenuOpen(false);
                setSearchOpen(false);
              }}
            >
              <strong className="navbar__logo-icon">
                <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="CAMPUSXCHANGE Logo" className="navbar__logo-img" />
              </strong>
              <span className="navbar__logo-text">CAMPUSXCHANGE</span>
            </button>

            {/* Desktop search lives inline in the main navbar.
                Mobile does not use this element for interaction; mobile opens the
                separate overlay search UI instead. */}
            <form className="navbar__search navbar__search--desktop" role="search" onSubmit={(e) => e.preventDefault()}>
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

            <form className="navbar__search navbar__search--logged-out-mobile" role="search" onSubmit={(e) => e.preventDefault()}>
              <label className="navbar__search-icon" aria-hidden="true">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </label>
              <input
                type="search"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={onSearchFocus}
                onClick={onSearchFocus}
              />
            </form>

            <div className="navbar__actions">
              {/* Compact mobile controls.
                  This area is intentionally different from desktop:
                  mobile gets a wider "Search..." trigger, and desktop keeps the
                  full search bar visible all the time. */}
              <div className="navbar__mobile-actions" aria-label="Quick actions">
                <button
                  className="navbar__mobile-search-trigger"
                  type="button"
                  aria-label="Open search"
                  aria-expanded={searchOpen}
                  onClick={() => {
                    setMenuOpen(false);
                    setSearchOpen(true);
                  }}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <span>Search...</span>
                </button>

                {user && (
                  <>
                    {/* The rest of the mobile actions stay compact so the row
                        still fits cleanly on smaller screens. */}
                    <button className="navbar__icon-btn" onClick={() => { onMessages?.(); }} type="button" aria-label="Open messages">
                      <span className="navbar__icon-btn-wrap">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        {unreadCount > 0 && (
                          <span
                            className="navbar__mobile-badge"
                            data-count={unreadCount > 99 ? "99+" : unreadCount}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </button>

                    <button className="navbar__icon-btn navbar__icon-btn--profile" title={user.email} onClick={onProfile} type="button" aria-label="Open profile">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="navbar__mobile-avatar" />
                      ) : (
                        renderFallbackAvatar("navbar__mobile-avatar navbar__mobile-avatar--placeholder")
                      )}
                    </button>

                    <button className="navbar__icon-btn navbar__icon-btn--plus" onClick={onShowListingForm} type="button" aria-label="List item">
                      <span aria-hidden="true">+</span>
                    </button>
                  </>
                )}
              </div>

              {/* Desktop/tablet navigation stays grouped here.
                  These links are hidden on mobile so we can keep mobile behavior
                  in its own simpler interaction path. */}
              <nav aria-label="User navigation">
                <ul className="navbar__links">
                  {user ? (
                    <>
                      <li>
                        <button className="navbar__link" onClick={onMessages} style={{ position: "relative" }}>
                          <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            {unreadCount > 0 && (
                              <span
                                style={{
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
                                }}
                              >
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
                            renderFallbackAvatar("navbar__desktop-avatar-placeholder")
                          )}
                          {displayName}
                        </button>
                      </li>
                      <li><button className="navbar__link" onClick={onBookings}>My Bookings</button></li>
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

              {/* The hamburger remains available for the side menu.
                  It sits outside the desktop links so the menu logic is shared,
                  even though the visible layout differs by screen size. */}
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
                    {/* Backdrop lets the user tap away without hunting for a close control. */}
                    <div className="navbar__menu-backdrop" onClick={() => setMenuOpen(false)} />
                    {/* The side menu stays shared so we do not duplicate the account actions. */}
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
                            {isAdmin && (
                              <li>
                                <button onClick={() => { onAdminDashboard?.(); setMenuOpen(false); }}>
                                  Admin Dashboard
                                </button>
                              </li>
                            )}
                            <li>
                              <button onClick={() => { onBookings?.(); setMenuOpen(false); }}>
                                My Bookings
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={() => { onWishlist?.(); setMenuOpen(false); }}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                              >
                                <span>Wishlist</span>
                                {wishlistCount > 0 && (
                                  <span
                                    style={{
                                      background: "#166534",
                                      color: "#fff",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      borderRadius: 20,
                                      padding: "1px 7px",
                                      minWidth: 20,
                                      textAlign: "center",
                                    }}
                                  >
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
          </>
        )}
      </header>
    </>
  );
}
