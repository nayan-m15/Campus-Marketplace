import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/NavBar";
import Hero from "./components/Hero";
import CategoryBar from "./components/CategoryBar";
import ListingsGrid from "./components/ListingsGrid";
import Footer from "./components/Footer";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";
import { fetchListings } from "./data/listings";
import "./styles/index.css";
import ListingForm from "./components/ListingForm";
import { supabase } from "./supabaseClient";

// ── Item details popup ────────────────────────────────────
function ListingDetailsModal({ item, onClose }) {
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

    setSending(true);
    setSendError("");
    setSendSuccess("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in to send a message.");
      }

      if (!item.user_id) {
        throw new Error("Seller information is missing.");
      }

      if (user.id === item.user_id) {
        throw new Error("You cannot message yourself about your own listing.");
      }

      const { error: insertError } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: item.user_id,
        content: message.trim(),
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setMessage("");
      setSendSuccess("Message sent successfully.");
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
                  <strong>Joined in:</strong> 2026
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

                <textarea
                  className="item-modal-textarea"
                  placeholder={`Hi, is the ${
                    item.title || "item"
                  } still available?`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />

                {sendError && <p className="item-modal-error">{sendError}</p>}

                {sendSuccess && (
                  <p className="item-modal-success">{sendSuccess}</p>
                )}

                <button
                  type="button"
                  className="item-modal-send-btn"
                  onClick={handleSendMessage}
                  disabled={sending}
                >
                  {sending ? "Sending..." : "Send message"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}

// ── Inner app — has access to AuthContext ──────────────────
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

  useEffect(() => {
    fetchListings()
      .then(setAllListings)
      .catch((err) => setListingsError(err.message))
      .finally(() => setListingsLoading(false));
  }, []);

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

  if (!loading && user && (page === "login" || page === "signup")) {
    setPage("home");
  }

  if (loading) {
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

  return (
    <>
      <header>
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          user={user}
          onLogin={() => setPage("login")}
          onSignup={() => setPage("signup")}
          onShowListingForm={() => setShowForm(true)}
          onSignOut={signOut}
        />

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
              Loading listings...
            </p>
          ) : (
            <ListingsGrid
              listings={filteredListings}
              searchQuery={searchQuery}
              activeCategory={activeCategory}
              onListingClick={setSelectedListing}
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