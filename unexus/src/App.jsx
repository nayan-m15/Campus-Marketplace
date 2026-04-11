import { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/NavBar";
import Hero from "./components/Hero";
import CategoryBar from "./components/FilterBar.jsx";
import ListingsGrid from "./components/ListingsGrid";
import Footer from "./components/Footer";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";
import ProfilePage from "./components/ProfilePage";
import PublicProfilePage from "./components/PublicProfilePage";
import ProfileSetupPage from "./components/ProfileSetupPage";
import MessagesPage from "./components/MessagesPage";
import AdminDashboard from "./components/AdminDashboard.jsx";
import WishlistPage from "./components/WishlistPage";
import { fetchListings, CONDITIONS } from "./data/listings";
import "./styles/index.css";
import ListingForm from "./components/ListingForm";
import { supabase } from "./supabaseClient";
import TradeFacilityDashboard from "./components/TradeFacilityDashboard";
import YourListingsPage from "./components/YourListingsPage";
import { useWishlist } from "./context/useWishlist";

const REQUIRED_PROFILE_FIELDS = ["name", "sex", "birthdate", "province", "institution"];

function isProfileComplete(profile) {
  if (!profile) return false;
  return REQUIRED_PROFILE_FIELDS.every((f) => !!profile[f]);
}

// ── Item Details Modal ─────────────────────────────────────
function ListingDetailsModal({ item, onClose, onMessageSeller, user, isWishlisted, onToggleWishlist }) {
  const [message, setMessage] = useState(
    `Hi, is the ${item?.title || "item"} still available?`
  );
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");

  useEffect(() => {
    if (item) {
      setMessage(`Hi, is the ${item.title || "item"} still available?`);
    }
  }, [item?.id]);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    if (item) {
      window.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
      setSendError("");
      setSendSuccess("");
    };
  }, [item, onClose]);

  if (!item) return null;

  const images =
    Array.isArray(item.image_urls) && item.image_urls.length > 0
      ? item.image_urls
      : item.image_url
      ? [item.image_url]
      : [];

  const firstImage = images[0] || null;
  const wishlisted = isWishlisted?.(item.id) ?? false;

  async function handleSendMessage() {
    if (!message.trim()) { setSendError("Please enter a message."); setSendSuccess(""); return; }
    if (!user) { setSendError("You must be logged in to send a message."); setSendSuccess(""); return; }
    if (!item.user_id) { setSendError("Seller information is missing."); setSendSuccess(""); return; }
    if (user.id === item.user_id) { setSendError("You cannot message yourself about your own listing."); setSendSuccess(""); return; }

    setSending(true);
    setSendError("");
    setSendSuccess("");

    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: item.user_id,
        content: message.trim(),
      });
      if (error) throw new Error(error.message);
      setMessage("");
      setSendSuccess("Message sent! Opening conversation…");
      setTimeout(() => { onClose(); onMessageSeller(item); }, 1000);
    } catch (err) {
      setSendError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="item-modal-overlay" onClick={onClose}>
      <article className="item-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close item details" type="button">×</button>

        <section className="item-modal-layout">
          <div className="item-modal-right-column item-modal-right-column--full">

            <div className="item-modal-top-card">
              <div className="item-modal-top-row">
                {firstImage ? (
                  <img src={firstImage} alt={item.title || "Listing image"} className="item-modal-top-image" />
                ) : (
                  <div className="item-modal-top-placeholder"><span>{item.emoji || "📦"}</span></div>
                )}
                <div className="item-modal-top-text">
                  <h2 className="item-modal-title">{item.title || "Untitled listing"}</h2>
                  <span className="item-modal-condition">{item.condition || "Good"}</span>
                  <p className="item-modal-price">
                    {item.pricePrefix && <span className="item-modal-price-prefix">{item.pricePrefix} </span>}
                    {item.price || "Price not available"}
                  </p>

                  {/* ── Wishlist button in modal ── */}
                  {user && onToggleWishlist && (
                    <button
                      type="button"
                      className={`item-modal-wishlist-btn${wishlisted ? " item-modal-wishlist-btn--active" : ""}`}
                      onClick={() => onToggleWishlist(item.id)}
                      aria-pressed={wishlisted}
                      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    >
                      {wishlisted ? "♥ Wishlisted" : "♡ Add to Wishlist"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="item-modal-description-card">
              <h3>Description</h3>
              <p>{item.description?.trim() || "No description provided."}</p>
            </div>

            <div className="item-modal-bottom-card">
              <div className="item-modal-meta">
                <p><strong>Seller:</strong> {item.seller || "Unknown seller"}</p>
                <p><strong>Approximate location:</strong> {item.approximate_location || "Location not provided"}</p>
                <p><strong>Joined in:</strong> {item.joined_year || 2026}</p>
                {item.category && <p><strong>Category:</strong> {item.category}</p>}
                <p><strong>Distance:</strong> {item.distance || "0 km"}</p>
              </div>

              <div className="item-modal-contact">
                <h3>Message seller</h3>
                {!user ? (
                  <p className="item-modal-error">Please <strong>log in</strong> to message this seller.</p>
                ) : (
                  <>
                    <textarea
                      className="item-modal-textarea"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                    />
                    {sendError && <p className="item-modal-error">{sendError}</p>}
                    {sendSuccess && <p className="item-modal-success">{sendSuccess}</p>}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button type="button" className="item-modal-send-btn" onClick={handleSendMessage} disabled={sending}>
                        {sending ? "Sending..." : "Send message"}
                      </button>
                      <button type="button" className="item-modal-send-btn" style={{ background: "var(--green)" }} onClick={() => { onClose(); onMessageSeller(item); }}>
                        Open chat
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </section>
      </article>
    </div>
  );
}

// ── Inner App ──────────────────────────────────────────────
function AppInner() {
  const { user, loading, signOut } = useAuth();

  const [page, setPage] = useState("home");
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [activeCondition, setActiveCondition] = useState("All Conditions");
  const [priceSort, setPriceSort] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);

  const [allListings, setAllListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState(null);

  const [avatarUrl, setAvatarUrl] = useState(null);
  const [profileName, setProfileName] = useState(null);
  const [msgRecipientId, setMsgRecipientId] = useState(null);
  const [msgListingTitle, setMsgListingTitle] = useState(null);

  const [profileChecked, setProfileChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

  // ── Wishlist ───────────────────────────────────────────────
  const { wishlistItems, isWishlisted, toggleWishlist, loading: wishlistLoading } = useWishlist(user);

  // ── Ref for the filter bar nav so Hero can scroll to it ──
  const filterBarRef = useRef(null);

  function handleScrollToListings() {
    filterBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Public profile state ───────────────────────────────────
  const [publicProfileId, setPublicProfileId] = useState(null);
  const [prevPage, setPrevPage] = useState("home");

  useEffect(() => {
    fetchListings()
      .then(setAllListings)
      .catch((err) => setListingsError(err.message))
      .finally(() => setListingsLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setProfileChecked(false);
      setNeedsSetup(false);
      setAvatarUrl(null);
      setIsAdmin(false);
      setIsStaff(false);
      return;
    }

    supabase
      .from("profiles")
      .select("name, avatar_url, role, sex, birthdate, province, institution")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAvatarUrl(data.avatar_url || null);
          setProfileName(data.name || null);
          setIsAdmin(data.role === "admin");
          setIsStaff(data.role === "staff");
          setNeedsSetup(!isProfileComplete(data));
        } else {
          setNeedsSetup(true);
        }
        setProfileChecked(true);
      })
      .catch(() => setProfileChecked(true));
  }, [user]);

  function numericPrice(item) {
    if (!item?.price) return 0;
    const n = parseFloat(String(item.price).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  const filteredListings = (() => {
    let result = allListings.filter((item) => {
      const searchMatch = searchQuery.trim()
        ? item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const categoryMatch =
        searchQuery.trim() || activeCategory === "All Items"
          ? true
          : item.category === activeCategory;

      const conditionMatch =
        activeCondition === "All Conditions" || item.condition === activeCondition;

      const minOk =
        priceSort !== "custom" ||
        priceRange.min === "" ||
        numericPrice(item) >= Number(priceRange.min);

      const maxOk =
        priceSort !== "custom" ||
        priceRange.max === "" ||
        numericPrice(item) <= Number(priceRange.max);

      return searchMatch && categoryMatch && conditionMatch && minOk && maxOk;
    });

    if (priceSort === "price_asc")      result = [...result].sort((a, b) => numericPrice(a) - numericPrice(b));
    if (priceSort === "price_desc")     result = [...result].sort((a, b) => numericPrice(b) - numericPrice(a));
    if (priceSort === "condition_asc")  result = [...result].sort((a, b) => CONDITIONS.indexOf(b.condition) - CONDITIONS.indexOf(a.condition));
    if (priceSort === "condition_desc") result = [...result].sort((a, b) => CONDITIONS.indexOf(a.condition) - CONDITIONS.indexOf(b.condition));
    if (priceSort === "newest")         result = [...result].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return result;
  })();

  function handleCategoryChange(category) {
    setActiveCategory(category);
    setSearchQuery("");
  }

  function handleClearFilters() {
    setActiveCondition("All Conditions");
    setPriceRange({ min: "", max: "" });
    setPriceSort("");
  }

  function handleAuthNavigate(target) {
    setPage(target === "home" ? "home" : target);
  }

  function handleListingSuccess() {
    setShowForm(false);
    setSuccessMessage("🎉 Your listing has been published!");
    setTimeout(() => setSuccessMessage(null), 4000);
    fetchListings()
      .then(setAllListings)
      .catch((err) => setListingsError(err.message));
  }

  function handleMessageSeller(item) {
    if (!user) {
      setPage("login");
      return;
    }
    setMsgRecipientId(item.user_id || null);
    setMsgListingTitle(item.title);
    setPage("messages");
  }

  function handleSellerClick(sellerId) {
    if (user && sellerId === user.id) {
      setPage("profile");
      return;
    }
    setPrevPage("home");
    setPublicProfileId(sellerId);
    setPage("publicProfile");
  }

  function handleSetupComplete() {
    setNeedsSetup(false);
    setPage("home");
  }

  function goHome() {
    setPage("home");
    setSearchQuery("");
  }

  if (!loading && user && (page === "login" || page === "signup")) {
    setPage("home");
  }

  if (loading || (user && !profileChecked)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", color: "var(--gray-600)" }}>
        Loading…
      </div>
    );
  }

  if (page === "login") return <LoginPage onNavigate={handleAuthNavigate} />;
  if (page === "signup") return <SignupPage onNavigate={handleAuthNavigate} />;

  if (user && needsSetup) return <ProfileSetupPage onComplete={handleSetupComplete} />;
  if (user && isStaff) return <TradeFacilityDashboard onSignOut={signOut} />;
  if (user && isAdmin) return <AdminDashboard onSignOut={signOut} />;

  const navbarProps = {
    searchQuery,
    onSearchChange: setSearchQuery,
    user,
    avatarUrl,
    profileName,
    onLogin: () => setPage("login"),
    onSignup: () => setPage("signup"),
    onShowListingForm: () => setShowForm(true),
    onProfile: () => setPage("profile"),
    onMessages: () => {
      setMsgRecipientId(null);
      setMsgListingTitle(null);
      setPage("messages");
    },
    onSignOut: signOut,
    onHome: goHome,
    onYourListings: () => setPage("yourlistings"),
    onWishlist: () => setPage("wishlist"),
    wishlistCount: wishlistItems.length,
  };

  if (page === "profile") {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        <ProfilePage onBack={goHome} onAvatarChange={setAvatarUrl} onNameChange={setProfileName} />
      </>
    );
  }

  if (page === "publicProfile" && publicProfileId) {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        <PublicProfilePage
          userId={publicProfileId}
          onBack={() => setPage(prevPage)}
          onMessageSeller={
            user
              ? () => {
                  setMsgRecipientId(publicProfileId);
                  setMsgListingTitle(null);
                  setPage("messages");
                }
              : null
          }
        />
      </>
    );
  }

  if (page === "messages") {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        <MessagesPage
          initialRecipientId={msgRecipientId}
          initialListingTitle={msgListingTitle}
          onBack={() => {
            setMsgRecipientId(null);
            setMsgListingTitle(null);
            goHome();
          }}
          onViewProfile={(sellerId) => {
            setPrevPage("messages");
            setPublicProfileId(sellerId);
            setPage("publicProfile");
          }}
        />
      </>
    );
  }

  if (page === "yourlistings") {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        <YourListingsPage onBack={goHome} />
      </>
    );
  }

  // ── Wishlist page ──────────────────────────────────────────
  if (page === "wishlist") {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        <WishlistPage
          wishlistItems={wishlistItems}
          loading={wishlistLoading}
          onListingClick={(item) => {
            setSelectedListing(item);
            setPage("home");
          }}
          onToggleWishlist={toggleWishlist}
        />
      </>
    );
  }

  return (
    <>
      <header>
        <Navbar {...navbarProps} />

        {successMessage && (
          <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "var(--gray-900)", color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>
            {successMessage}
          </div>
        )}

        {showForm && (
          <dialog className="modal-overlay" open onClick={() => setShowForm(false)}>
            <article className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowForm(false)} aria-label="Close modal" type="button">×</button>
              <ListingForm onCancel={() => setShowForm(false)} onSuccess={handleListingSuccess} />
            </article>
          </dialog>
        )}

        <ListingDetailsModal
          item={selectedListing}
          onClose={() => setSelectedListing(null)}
          onMessageSeller={handleMessageSeller}
          user={user}
          isWishlisted={isWishlisted}
          onToggleWishlist={user ? toggleWishlist : null}
        />
      </header>

      <main>
        <section>
          <Hero onListingClick={setSelectedListing} onBrowseClick={handleScrollToListings} />
        </section>

        <nav aria-label="Categories" ref={filterBarRef}>
          <CategoryBar
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            activeCondition={activeCondition}
            onConditionChange={setActiveCondition}
            priceSort={priceSort}
            onPriceSortChange={setPriceSort}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
          />
        </nav>

        <section>
          {listingsError ? (
            <p style={{ padding: "24px 40px", color: "crimson" }}>{listingsError}</p>
          ) : listingsLoading ? (
            <p style={{ padding: "24px 40px", color: "var(--gray-600)" }}>Loading listings…</p>
          ) : (
            <ListingsGrid
              listings={filteredListings}
              searchQuery={searchQuery}
              activeCategory={activeCategory}
              onListingClick={setSelectedListing}
              onMessageSeller={handleMessageSeller}
              onSellerClick={handleSellerClick}
              isWishlisted={isWishlisted}
              onToggleWishlist={user ? toggleWishlist : null}
              user={user}
            />
          )}
        </section>
      </main>

      <footer><Footer /></footer>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
