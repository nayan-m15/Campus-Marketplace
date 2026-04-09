import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/NavBar";
import Hero from "./components/Hero";
import CategoryBar from "./components/CategoryBar";
import ListingsGrid from "./components/ListingsGrid";
import Footer from "./components/Footer";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";
import ProfilePage from "./components/ProfilePage";
import ProfileSetupPage from "./components/ProfileSetupPage";
import MessagesPage from "./components/MessagesPage";
import { fetchListings } from "./data/listings";
import "./styles/index.css";
import ListingForm from "./components/ListingForm";
import { supabase } from "./supabaseClient";

// Required fields that must be filled before accessing the app
const REQUIRED_PROFILE_FIELDS = ["name", "sex", "birthdate", "province", "institution"];

function isProfileComplete(profile) {
  if (!profile) return false;
  return REQUIRED_PROFILE_FIELDS.every((f) => !!profile[f]);
}

// ── Item Details Modal ─────────────────────────────────────
function ListingDetailsModal({ item, onClose, onMessageSeller, user }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");

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
      setMessage("");
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

  async function handleSendMessage() {
    if (!message.trim()) {
      setSendError("Please enter a message.");
      setSendSuccess("");
      return;
    }

    if (!user) {
      setSendError("You must be logged in to send a message.");
      setSendSuccess("");
      return;
    }

    if (!item.user_id) {
      setSendError("Seller information is missing.");
      setSendSuccess("");
      return;
    }

    if (user.id === item.user_id) {
      setSendError("You cannot message yourself about your own listing.");
      setSendSuccess("");
      return;
    }

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

      setTimeout(() => {
        onClose();
        onMessageSeller(item);
      }, 1000);
    } catch (err) {
      setSendError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="item-modal-overlay" onClick={onClose}>
      <article
        className="item-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close item details"
          type="button"
        >
          ×
        </button>

        <section className="item-modal-layout">
          <div className="item-modal-right-column item-modal-right-column--full">
            <div className="item-modal-top-card">
              <div className="item-modal-top-row">
                {firstImage ? (
                  <img
                    src={firstImage}
                    alt={item.title || "Listing image"}
                    className="item-modal-top-image"
                  />
                ) : (
                  <div className="item-modal-top-placeholder">
                    <span>{item.emoji || "📦"}</span>
                  </div>
                )}

                <div className="item-modal-top-text">
                  <h2 className="item-modal-title">
                    {item.title || "Untitled listing"}
                  </h2>

                  <span className="item-modal-condition">
                    {item.condition || "Good"}
                  </span>

                  <p className="item-modal-price">
                    {item.pricePrefix && (
                      <span className="item-modal-price-prefix">
                        {item.pricePrefix}{" "}
                      </span>
                    )}
                    {item.price || "Price not available"}
                  </p>
                </div>
              </div>
            </div>

            <div className="item-modal-description-card">
              <h3>Description</h3>
              <p>{item.description?.trim() || "No description provided."}</p>
            </div>

            <div className="item-modal-bottom-card">
              <div className="item-modal-meta">
                <p>
                  <strong>Seller:</strong> {item.seller || "Unknown seller"}
                </p>

                <p>
                  <strong>Approximate location:</strong>{" "}
                  {item.approximate_location || "Location not provided"}
                </p>

                <p>
                  <strong>Joined in:</strong> {item.joined_year || 2026}
                </p>

                {item.category && (
                  <p>
                    <strong>Category:</strong> {item.category}
                  </p>
                )}

                <p>
                  <strong>Distance:</strong> {item.distance || "0 km"}
                </p>
              </div>

              <div className="item-modal-contact">
                <h3>Message seller</h3>

                {!user ? (
                  <p className="item-modal-error">
                    Please <strong>log in</strong> to message this seller.
                  </p>
                ) : (
                  <>
                    <textarea
                      className="item-modal-textarea"
                      placeholder={`Hi, is the ${
                        item.title || "item"
                      } still available?`}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                    />

                    {sendError && (
                      <p className="item-modal-error">{sendError}</p>
                    )}

                    {sendSuccess && (
                      <p className="item-modal-success">{sendSuccess}</p>
                    )}

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="item-modal-send-btn"
                        onClick={handleSendMessage}
                        disabled={sending}
                      >
                        {sending ? "Sending..." : "Send message"}
                      </button>

                      <button
                        type="button"
                        className="item-modal-send-btn"
                        style={{ background: "var(--green)" }}
                        onClick={() => {
                          onClose();
                          onMessageSeller(item);
                        }}
                      >
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

  // Profile setup gate
  const [profileChecked, setProfileChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    fetchListings()
      .then(setAllListings)
      .catch((err) => setListingsError(err.message))
      .finally(() => setListingsLoading(false));
  }, []);

  // When user logs in, check if their profile is complete
  useEffect(() => {
    if (!user) {
      setProfileChecked(false);
      setNeedsSetup(false);
      setAvatarUrl(null);
      return;
    }

    supabase
      .from("profiles")
      .select("name, display_name, sex, birthdate, province, institution, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        if (data?.display_name || data?.name) {            
            setProfileName(data.display_name || data.name);
        }
        setNeedsSetup(!isProfileComplete(data));
        setProfileChecked(true);
      })
      .catch(() => {
        // No profile row yet — needs setup
        setNeedsSetup(true);
        setProfileChecked(true);
      });
  }, [user]);

  const filteredListings = searchQuery.trim()
    ? allListings.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeCategory === "All Items"
    ? allListings
    : allListings.filter((item) => item.category === activeCategory);

  function handleCategoryChange(category) {
    setActiveCategory(category);
    setSearchQuery("");
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

  // Show spinner while auth OR profile check is in progress
  if (loading || (user && !profileChecked)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font)",
          color: "var(--gray-600)",
        }}
      >
        Loading…
      </div>
    );
  }

  if (page === "login") return <LoginPage onNavigate={handleAuthNavigate} />;
  if (page === "signup") return <SignupPage onNavigate={handleAuthNavigate} />;

  // ── Profile setup gate — no navbar, can't escape ──
  if (user && needsSetup) {
    return <ProfileSetupPage onComplete={handleSetupComplete} />;
  }

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
  };

  if (page === "profile") {
    return (
      <>
        <header>
          <Navbar {...navbarProps} />
        </header>
        <ProfilePage onBack={goHome} onAvatarChange={setAvatarUrl} onNameChange={setProfileName}/>
      </>
    );
  }

  if (page === "messages") {
    return (
      <>
        <header>
          <Navbar {...navbarProps} />
        </header>
        <MessagesPage
          initialRecipientId={msgRecipientId}
          initialListingTitle={msgListingTitle}
          onBack={() => {
            setMsgRecipientId(null);
            setMsgListingTitle(null);
            goHome();
          }}
        />
      </>
    );
  }

  return (
    <>
      <header>
        <Navbar {...navbarProps} />

        {successMessage && (
          <div
            style={{
              position: "fixed",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#111",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              zIndex: 9999,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              whiteSpace: "nowrap",
            }}
          >
            {successMessage}
          </div>
        )}

        {showForm && (
          <dialog
            className="modal-overlay"
            open
            onClick={() => setShowForm(false)}
          >
            <article
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
                aria-label="Close modal"
                type="button"
              >
                ×
              </button>
              <ListingForm
                onCancel={() => setShowForm(false)}
                onSuccess={handleListingSuccess}
              />
            </article>
          </dialog>
        )}

        <ListingDetailsModal
          item={selectedListing}
          onClose={() => setSelectedListing(null)}
          onMessageSeller={handleMessageSeller}
          user={user}
        />
      </header>

      <main>
        <section>
          <Hero />
        </section>

        <nav aria-label="Categories">
          <CategoryBar
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
        </nav>

        <section>
          {listingsError ? (
            <p style={{ padding: "24px 40px", color: "crimson" }}>
              {listingsError}
            </p>
          ) : listingsLoading ? (
            <p style={{ padding: "24px 40px", color: "var(--gray-600)" }}>
              Loading listings…
            </p>
          ) : (
            <ListingsGrid
              listings={filteredListings}
              searchQuery={searchQuery}
              activeCategory={activeCategory}
              onListingClick={setSelectedListing}
              onMessageSeller={handleMessageSeller}
            />
          )}
        </section>
      </main>

      <footer>
        <Footer />
      </footer>
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