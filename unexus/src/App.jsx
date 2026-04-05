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
import { ALL_LISTINGS } from "./data/listings";
import "./styles/index.css";
import ListingForm from "./components/ListingForm";
import { supabase } from "./supabaseClient";

// Required fields that must be filled before accessing the app
const REQUIRED_PROFILE_FIELDS = ["name", "sex", "birthdate", "province", "institution"];

function isProfileComplete(profile) {
  if (!profile) return false;
  return REQUIRED_PROFILE_FIELDS.every((f) => !!profile[f]);
}

// ── Inner app ──────────────────────────────────────────────
function AppInner() {
  const { user, loading, signOut } = useAuth();
  const [page, setPage] = useState("home");
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Profile check state
  const [profileChecked, setProfileChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

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
      .select("name, sex, birthdate, province, institution, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        setNeedsSetup(!isProfileComplete(data));
        setProfileChecked(true);
      })
      .catch(() => {
        // No profile row yet — definitely needs setup
        setNeedsSetup(true);
        setProfileChecked(true);
      });
  }, [user]);

  const filteredListings = searchQuery.trim()
    ? ALL_LISTINGS.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeCategory === "All Items"
    ? ALL_LISTINGS
    : ALL_LISTINGS.filter((item) => item.category === activeCategory);

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
  }

  function handleSetupComplete() {
    setNeedsSetup(false);
    setPage("home");
  }

  if (!loading && user && (page === "login" || page === "signup")) {
    setPage("home");
  }

  // Show spinner while auth or profile check is in progress
  if (loading || (user && !profileChecked)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", color: "var(--gray-600)" }}>
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

  if (page === "profile") return (
    <>
      <header>
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          user={user}
          avatarUrl={avatarUrl}
          onLogin={() => setPage("login")}
          onSignup={() => setPage("signup")}
          onShowListingForm={() => setShowForm(true)}
          onProfile={() => setPage("profile")}
          onSignOut={signOut}
        />
      </header>
      <ProfilePage
        onBack={() => setPage("home")}
        onAvatarChange={setAvatarUrl}
      />
    </>
  );

  return (
    <>
      <header>
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          user={user}
          avatarUrl={avatarUrl}
          onLogin={() => setPage("login")}
          onSignup={() => setPage("signup")}
          onShowListingForm={() => setShowForm(true)}
          onProfile={() => setPage("profile")}
          onSignOut={signOut}
        />

        {successMessage && (
          <div style={{
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
          }}>
            {successMessage}
          </div>
        )}

        {showForm && (
          <dialog
            className="modal-overlay"
            open
            onClick={() => setShowForm(false)}
          >
            <article className="modal-content" onClick={(e) => e.stopPropagation()}>
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
      </header>

      <main>
        <section><Hero /></section>
        <nav aria-label="Categories">
          <CategoryBar
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
        </nav>
        <section>
          <ListingsGrid
            listings={filteredListings}
            searchQuery={searchQuery}
            activeCategory={activeCategory}
          />
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