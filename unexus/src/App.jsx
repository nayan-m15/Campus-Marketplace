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
import ListingForm from "./components/ListingForm";
import { supabase } from "./supabaseClient";

import "./styles/index.css";

// ── Profile Completion Logic ───────────────────────────────
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
      return;
    }

    if (!user) {
      setSendError("You must be logged in.");
      return;
    }

    if (!item.user_id || user.id === item.user_id) {
      setSendError("Invalid recipient.");
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
      setSendSuccess("Message sent!");

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
      <article className="item-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <h2>{item.title}</h2>
        <p>{item.description}</p>

        {user && (
          <>
            <textarea
              placeholder={`Hi, is the ${item.title} still available?`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {sendError && <p className="item-modal-error">{sendError}</p>}
            {sendSuccess && <p className="item-modal-success">{sendSuccess}</p>}

            <button onClick={handleSendMessage} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </button>
          </>
        )}
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
  const [msgRecipientId, setMsgRecipientId] = useState(null);
  const [msgListingTitle, setMsgListingTitle] = useState(null);

  const [profileChecked, setProfileChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Fetch listings
  useEffect(() => {
    fetchListings()
      .then(setAllListings)
      .catch((err) => setListingsError(err.message))
      .finally(() => setListingsLoading(false));
  }, []);

  // Profile check
  useEffect(() => {
    if (!user) {
      setAvatarUrl(null);
      setProfileChecked(false);
      setNeedsSetup(false);
      return;
    }

    supabase
      .from("profiles")
      .select("name, sex, birthdate, province, institution, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        setNeedsSetup(!isProfileComplete(data));
        setProfileChecked(true);
      })
      .catch(() => {
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

  function handleSetupComplete() {
    setNeedsSetup(false);
    setPage("home");
  }

  function handleMessageSeller(item) {
    if (!user) return setPage("login");

    setMsgRecipientId(item.user_id);
    setMsgListingTitle(item.title);
    setPage("messages");
  }

  function goHome() {
    setPage("home");
    setSearchQuery("");
  }

  if (loading || (user && !profileChecked)) {
    return <div style={{ textAlign: "center", marginTop: 100 }}>Loading...</div>;
  }

  if (page === "login") return <LoginPage onNavigate={setPage} />;
  if (page === "signup") return <SignupPage onNavigate={setPage} />;

  if (user && needsSetup) {
    return <ProfileSetupPage onComplete={handleSetupComplete} />;
  }

  const navbarProps = {
    searchQuery,
    onSearchChange: setSearchQuery,
    user,
    avatarUrl,
    onLogin: () => setPage("login"),
    onSignup: () => setPage("signup"),
    onShowListingForm: () => setShowForm(true),
    onProfile: () => setPage("profile"),
    onMessages: () => setPage("messages"),
    onSignOut: signOut,
    onHome: goHome,
  };

  if (page === "messages") {
    return (
      <>
        <Navbar {...navbarProps} />
        <MessagesPage
          initialRecipientId={msgRecipientId}
          initialListingTitle={msgListingTitle}
          onBack={goHome}
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
        onCategoryChange={setActiveCategory}
      />

      <ListingsGrid
        listings={filteredListings}
        onListingClick={setSelectedListing}
        onMessageSeller={handleMessageSeller}
      />

      <Footer />

      <ListingDetailsModal
        item={selectedListing}
        onClose={() => setSelectedListing(null)}
        onMessageSeller={handleMessageSeller}
        user={user}
      />
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