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

// ── Inner app — has access to AuthContext ──────────────────
function AppInner() {
  const { user, loading, signOut } = useAuth();
  const [page, setPage] = useState("home");
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

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

    // Pull fresh data so the new listing appears immediately
    fetchListings()
      .then(setAllListings)
      .catch((err) => setListingsError(err.message));
  }

  if (!loading && user && (page === "login" || page === "signup")) {
    setPage("home");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", color: "var(--gray-600)" }}>
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

        {/* ── Success toast ── */}
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

        {/* ── Listing form modal ── */}
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
