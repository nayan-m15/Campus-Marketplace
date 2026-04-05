import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "../styles/Navbar.css";

export default function Navbar({
  searchQuery,
  onSearchChange,
  user,
  onLogin,
  onSignup,
  onSignOut,
  onShowListingForm,
  onProfile,
}) {
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Pull display name same way as before
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Profile";

  // Load avatar from profiles table whenever user changes
  useEffect(() => {
    if (!user) { setAvatarUrl(null); return; }

    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [user]);

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
            <>
              <li>
                <button className="navbar__link">
                  Messages
                </button>
              </li>

              {/* Profile button — shows avatar if set, otherwise 👤 + name */}
              <li>
                <button
                  className="navbar__link navbar__link--user"
                  title={user.email}
                  onClick={onProfile}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span>👤</span>
                  )}
                  {displayName}
                </button>
              </li>

              <li>
                <button className="navbar__link" onClick={onSignOut}>
                  Sign Out
                </button>
              </li>
              <li>
                <button className="btn-primary navbar__list-btn" onClick={onShowListingForm}>
                  <span>+</span> List Item
                </button>
              </li>
            </>
          ) : (
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