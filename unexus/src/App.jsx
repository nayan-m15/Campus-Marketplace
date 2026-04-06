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
import MessagesPage from "./components/MessagesPage";
import ListingForm from "./components/ListingForm";
import { fetchListings } from "./data/listings";
import { supabase } from "./supabaseClient";
import "./styles/index.css";

// ── Modal ────────────────────────────────────────────────
function ListingDetailsModal({ item, onClose, onMessageSeller, user }) {
  if (!item) return null;

  return (
    <div className="item-modal-overlay" onClick={onClose}>
      <article className="item-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <h2>{item.title}</h2>
        <p>{item.price}</p>
        <p>{item.description || "No description provided."}</p>

        <p><strong>Seller:</strong> {item.seller}</p>
        <p><strong>Location:</strong> {item.approximate_location}</p>

        {user && user.id !== item.user_id && (
          <button onClick={() => onMessageSeller(item)}>
            💬 Message Seller
          </button>
        )}
      </article>
    </div>
  );
}

// ── Inner App ────────────────────────────────────────────
function AppInner() {
  const { user, loading, signOut } = useAuth();

  const [page, setPage] = useState("home");
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  const [allListings, setAllListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState(null);

  const [avatarUrl, setAvatarUrl] = useState(null);

  const [msgRecipientId, setMsgRecipientId] = useState(null);
  const [msgListingTitle, setMsgListingTitle] = useState(null);

  // ── Fetch listings ─────────────────────────────────────
  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    setListingsLoading(true);
    setListingsError(null);

    try {
      const data = await fetchListings();
      setAllListings(data);
    } catch (err) {
      setListingsError(err.message);
    } finally {
      setListingsLoading(false);
    }
  }

  // ── Load avatar ────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setAvatarUrl(null);
      return;
    }

    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [user]);

  // ── Filtering ──────────────────────────────────────────
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

  function handleListingSuccess() {
    setShowForm(false);
    loadListings(); // 🔥 refetch after posting
  }

  function handleMessageSeller(item) {
    if (!user) {
      setPage("login");
      return;
    }
    setMsgRecipientId(item.user_id);
    setMsgListingTitle(item.title);
    setPage("messages");
  }

  function openMessages() {
    setMsgRecipientId(null);
    setMsgListingTitle(null);
    setPage("messages");
  }

  // ── Routing guards ─────────────────────────────────────
  if (!loading && user && (page === "login" || page === "signup")) {
    setPage("home");
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Loading…</div>;
  }

  if (page === "login") return <LoginPage onNavigate={setPage} />;
  if (page === "signup") return <SignupPage onNavigate={setPage} />;

  const navbarProps = {
    searchQuery,
    onSearchChange: setSearchQuery,
    user,
    avatarUrl,
    onLogin: () => setPage("login"),
    onSignup: () => setPage("signup"),
    onShowListingForm: () => setShowForm(true),
    onProfile: () => setPage("profile"),
    onMessages: openMessages,
    onSignOut: signOut,
  };

  if (page === "profile") {
    return (
      <>
        <Navbar {...navbarProps} />
        <ProfilePage onBack={() => setPage("home")} onAvatarChange={setAvatarUrl} />
      </>
    );
  }

  if (page === "messages") {
    return (
      <>
        <Navbar {...navbarProps} />
        <MessagesPage
          initialRecipientId={msgRecipientId}
          initialListingTitle={msgListingTitle}
          onBack={() => setPage("home")}
        />
      </>
    );
  }

  return (
    <>
      <Navbar {...navbarProps} />

      <Hero />

      <CategoryBar
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
      />

      {showForm && (
        <ListingForm
          onCancel={() => setShowForm(false)}
          onSuccess={handleListingSuccess}
        />
      )}

      {listingsError && (
        <p style={{ color: "red", padding: 20 }}>{listingsError}</p>
      )}

      {listingsLoading ? (
        <p style={{ padding: 20 }}>Loading listings…</p>
      ) : (
        <ListingsGrid
          listings={filteredListings}
          onListingClick={setSelectedListing}
          onMessageSeller={handleMessageSeller}
        />
      )}

      <ListingDetailsModal
        item={selectedListing}
        onClose={() => setSelectedListing(null)}
        onMessageSeller={handleMessageSeller}
        user={user}
      />

      <Footer />
    </>
  );
}

// ── Wrapper ──────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}