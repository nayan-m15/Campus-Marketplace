import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/NavBar";
import Hero from "./components/Hero";
import CategoryBar from "./components/CategoryBar";
import ListingsGrid from "./components/ListingsGrid";
import Footer from "./components/Footer";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";
import { ALL_LISTINGS } from "./data/listings";
import "./styles/index.css";
import ListingForm from "./components/ListingForm";
import Draggable from 'react-draggable'; 

// ── Inner app — has access to AuthContext ──────────────────
function AppInner() {
  const { user, loading, signOut } = useAuth();
  const [page, setPage] = useState("home"); // "home" | "login" | "signup"
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false); 

  // Filtered listings
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

  // After login/signup, send user home
  function handleAuthNavigate(target) {
    if (target === "home") {
      setPage("home");
    } else {
      setPage(target);
    }
  }

  // When user logs in successfully, AuthContext updates → go home
  // We detect this: if user is set and we're on login/signup, redirect home
  if (!loading && user && (page === "login" || page === "signup")) {
    setPage("home");
  }

  // Show a minimal spinner while Supabase resolves the session
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", color: "var(--gray-600)" }}>
        Loading…
      </div>
    );
  }

  if (page === "login") {
    return <LoginPage onNavigate={handleAuthNavigate} />;
  }

  if (page === "signup") {
    return <SignupPage onNavigate={handleAuthNavigate} />;
  }

  return (
    <>
      <header>
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          user={user}
          onLogin={() => setPage("login")}
          onSignup={() => setPage("signup")}
          onShowListingForm = {() => setShowForm(true)}
          onSignOut={signOut}
        />
        
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
                <ListingForm onClose={() => setShowForm(false)} />
              </article>
            </dialog>
          )}
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
          <ListingsGrid
            listings={filteredListings}
            searchQuery={searchQuery}
            activeCategory={activeCategory}
          />
        </section>
      </main>

      <footer>
        <Footer />
      </footer>
    </>
  );
}

// ── Root — wraps everything in AuthProvider ────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}