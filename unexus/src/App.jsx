import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/NavBar";
import Hero from "./components/Hero";
import CategoryBar from "./components/FilterBar.jsx";
import ListingsGrid from "./components/ListingsGrid";
import Footer from "./components/Footer";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";
import ProfilePage from "./components/ProfilePage";
import ProfileSetupPage from "./components/ProfileSetupPage";
import MessagesPage from "./components/MessagesPage";
import AdminDashboard from "./components/AdminDashboard.jsx";
import { fetchListings } from "./data/listings";
import "./styles/index.css";
import ListingForm from "./components/ListingForm";
import { supabase } from "./supabaseClient";
import TradeFacilityDashboard from "./components/TradeFacilityDashboard";

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
    <dialog open onClick={onClose}>
      <article onClick={(e) => e.stopPropagation()}>
        <header>
          <button onClick={onClose}>×</button>
        </header>

        <section>
          <article>
            <header>
              <figure>
                {firstImage ? (
                  <img src={firstImage} alt={item.title} />
                ) : (
                  <figcaption>{item.emoji || "📦"}</figcaption>
                )}
              </figure>

              <section>
                <h2>{item.title}</h2>
                <p>{item.condition}</p>
                <p>{item.price}</p>
              </section>
            </header>
            </article>

          <article>
            <h3>Description</h3>
            <p>{item.description || "No description"}</p>
          </article>

          <article>
            <section>
              <p><strong>Seller:</strong> {item.seller}</p>
              <p><strong>Location:</strong> {item.approximate_location}</p>
            </section>

            <aside>
              <h3>Message seller</h3>

              {!user ? (
                <p>Login to message</p>
              ) : (
                <>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />

                  {sendError && <p>{sendError}</p>}
                  {sendSuccess && <p>{sendSuccess}</p>}

                  <footer>
                    <button onClick={handleSendMessage} disabled={sending}>
                      {sending ? "Sending..." : "Send"}
                    </button>
                    <button onClick={() => onMessageSeller(item)}>
                      Chat
                    </button>
                  </footer>
                </>
              )}
            </aside>
          </article>
        </section>
      </article>
    </dialog>
  );
}

// ── Inner App ──────────────────────────────────────────────
function AppInner() {
  const { user, loading, signOut } = useAuth();

  const [page, setPage] = useState("home");
  const [activeCategory, setActiveCategory] = useState("All Items");
  // ── NEW: condition + price filter state ───────────────────
  const [activeCondition, setActiveCondition] = useState("All Conditions");
  const [priceSort, setPriceSort] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  // ─────────────────────────────────────────────────────────
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
      .select("name, display_name, sex, birthdate, province, institution, avatar_url, role")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        setIsAdmin(data?.role === "admin");
        if (data?.display_name || data?.name) {
          setProfileName(data.display_name || data.name);
        }
        setIsStaff(data?.role === "staff");
        setNeedsSetup(!isProfileComplete(data));
        setProfileChecked(true);
      })
      .catch(() => {
        setIsStaff(false);
        setIsAdmin(false);
        setNeedsSetup(true);
        setProfileChecked(true);
      });
  }, [user]);

  // ── Updated: applies category, search, condition, and price ──
  const filteredListings = (() => {
  const numericPrice = (item) =>
    Number(String(item.price).replace(/[^0-9.]/g, ""));

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

  if (priceSort === "asc")  result = [...result].sort((a, b) => numericPrice(a) - numericPrice(b));
  if (priceSort === "desc") result = [...result].sort((a, b) => numericPrice(b) - numericPrice(a));

  return result;
  })();

  function handleCategoryChange(category) {
    setActiveCategory(category);
    setSearchQuery("");
  }

  // ── NEW: reset all secondary filters together ─────────────
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
  };

  if (page === "profile") {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        <ProfilePage onBack={goHome} onAvatarChange={setAvatarUrl} onNameChange={setProfileName} />
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
        />
      </>
    );
  }

  return (
    <>
      <header>
        <Navbar {...navbarProps} />

        {successMessage && (
          <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>
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
        />
      </header>

      <main>
        <section><Hero /></section>

        <nav aria-label="Categories">
          {/* ── All new filter props wired in ── */}
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