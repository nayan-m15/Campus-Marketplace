import "../styles/Hero.css";
import { useState, useEffect, useRef } from "react";
import { fetchListings, CONDITION_COLORS } from "../data/listings";
import { supabase } from "../supabaseClient";

function getSemesterStart(date = new Date()) {
  const month = date.getMonth();
  return month < 6
    ? new Date(date.getFullYear(), 0, 1)
    : new Date(date.getFullYear(), 6, 1);
}

function formatRand(value) {
  return `R ${Number(value || 0).toLocaleString("en-ZA")}`;
}

function formatStatCount(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return value.toLocaleString("en-ZA");
}

export default function Hero({
  onListingClick,
  onBrowseClick,
  onSignupClick,
  onLoginClick,
  user,
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  const [topListings, setTopListings] = useState([]);
  const [heroStats, setHeroStats] = useState([
    { label: "Active listings", value: "..." },
    { label: "Student users", value: "..." },
    { label: "Traded this semester", value: "..." },
  ]);

  useEffect(() => {
    fetchListings()
      .then((data) => setTopListings(data.slice(0, 6)))
      .catch((err) => console.error("Hero failed to load listings:", err));
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadHeroStats() {
      try {
        const semesterStart = getSemesterStart();
        const [
          { count: activeListingsCount, error: listingsCountError },
          { count: totalUsersCount, error: usersCountError },
          { data: soldListings, error: soldListingsError },
        ] = await Promise.all([
          supabase.from("listings").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase
            .from("listings")
            .select("price, created_at, status")
            .eq("status", "sold")
            .gte("created_at", semesterStart.toISOString()),
        ]);

        if (listingsCountError) throw listingsCountError;
        if (soldListingsError) throw soldListingsError;

        const semesterTradeValue = (soldListings || []).reduce((sum, listing) => {
          const price = typeof listing.price === "number"
            ? listing.price
            : parseFloat(String(listing.price || "").replace(/[^0-9.]/g, ""));

          return sum + (Number.isFinite(price) ? price : 0);
        }, 0);

        if (!isMounted) return;

        setHeroStats([
          { label: "Active listings", value: formatStatCount(activeListingsCount ?? 0) },
          {
            label: "Student users",
            value: usersCountError ? "N/A" : formatStatCount(totalUsersCount),
          },
          { label: "Traded this semester", value: formatRand(semesterTradeValue) },
        ]);
      } catch (error) {
        console.error("Hero stats failed to load:", error);
        if (!isMounted) return;

        setHeroStats([
          { label: "Active listings", value: String(topListings.length || 0) },
          { label: "Student users", value: "N/A" },
          { label: "Traded this semester", value: "R 0" },
        ]);
      }
    }

    loadHeroStats();

    return () => {
      isMounted = false;
    };
  }, [topListings.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % topListings.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + topListings.length) % topListings.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  useEffect(() => {
    if (!topListings.length || isPaused) return undefined;

    intervalRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % topListings.length);
    }, 4000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, topListings.length]);

  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  return (
    <section className="hero">
      <figure className="hero__bg" aria-hidden="true" />
      <figure className="hero__overlay" aria-hidden="true" />

      <div className="hero__main">
        <header className="hero__content">
          <h1 className="hero__title">Buy, Sell &amp; Trade</h1>
          <h2 className="hero__subtitle">Within Your Campus</h2>
          <p className="hero__description">
            The trusted marketplace built exclusively for university students.
            Safe trades, secure payments, campus convenience.
          </p>

          <nav className="hero__buttons" aria-label="Primary actions">
            <button
              className="btn-primary"
              style={{ fontSize: 15, padding: "13px 28px" }}
              onClick={onBrowseClick}
            >
              Start Browsing →
            </button>
            <button
              className="btn-outline"
              style={{ fontSize: 15, padding: "13px 28px" }}
            >
              How It Works
            </button>
          </nav>

          <ul className="hero__badges">
            {[
              "Verified Students",
              "Secure Trade Center",
              "Safe Payments",
            ].map((label) => (
              <li key={label} className="hero__badge">
                {label}
              </li>
            ))}
          </ul>

          <div className="hero__stats" aria-label="Marketplace stats">
            {heroStats.map((stat, index) => (
              <div key={stat.label} className="hero__stat-group">
                <div className="hero__stat">
                  <span className="hero__stat-value">{stat.value}</span>
                  <span className="hero__stat-label">{stat.label}</span>
                </div>
                {index < heroStats.length - 1 && (
                  <div className="hero__stat-divider" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </header>

        {topListings.length === 0 ? (
          <section
            className="hero__carousel"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <p style={{ color: "rgba(255,255,255,0.6)" }}>Loading listings…</p>
          </section>
        ) : (
          <section
            className="hero__carousel"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <section className="carousel-container">
              <section
                className="carousel-track"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {topListings.map((listing) => (
                  <article key={listing.id} className="carousel-slide">
                    <article className="listing-card">
                      <figure className="listing-image">
                        {listing.image_url ? (
                          <img
                            src={listing.image_url}
                            alt={listing.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span className="listing-emoji">{listing.emoji}</span>
                        )}
                        <figcaption className="listing-badge">{listing.category}</figcaption>
                      </figure>

                      <section className="listing-details">
                        <h3 className="listing-title">{listing.title}</h3>

                        <p className="listing-seller-info">
                          <span className="listing-seller">{listing.seller}</span>
                          <span className="listing-distance">📍 {listing.distance}</span>
                        </p>

                        <p className="listing-price-condition">
                          <span className="listing-price">{listing.price}</span>
                          <span
                            className="listing-condition"
                            style={{
                              backgroundColor: `${CONDITION_COLORS[listing.condition]}20`,
                              color: CONDITION_COLORS[listing.condition],
                            }}
                          >
                            {listing.condition}
                          </span>
                        </p>

                        <button
                          className="listing-button"
                          onClick={() => onListingClick(listing)}
                        >
                          View Details →
                        </button>
                      </section>
                    </article>
                  </article>
                ))}
              </section>

              <button
                className="carousel-nav carousel-nav--prev"
                onClick={prevSlide}
                aria-label="Previous slide"
              >
                ‹
              </button>
              <button
                className="carousel-nav carousel-nav--next"
                onClick={nextSlide}
                aria-label="Next slide"
              >
                ›
              </button>

              <nav className="carousel-dots">
                {topListings.map((_, index) => (
                  <button
                    key={index}
                    className={`carousel-dot ${index === currentSlide ? "carousel-dot--active" : ""}`}
                    onClick={() => goToSlide(index)}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </nav>
            </section>
          </section>
        )}
      </div>

      {!user && (
        <section className="sell-cta" aria-label="List your item">
          <div className="sell-cta__copy">
            <p className="sell-cta__eyebrow">Got something to sell?</p>
            <h3 className="sell-cta__heading">List it in under 60 seconds.</h3>
            <p className="sell-cta__sub">
              Free forever. Reach every student on campus instantly.
            </p>
          </div>

          <div className="sell-cta__actions">
            <button type="button" className="sell-cta__btn" onClick={onSignupClick}>
              Start listing <span className="sell-cta__btn-arrow">→</span>
            </button>
            <button type="button" className="sell-cta__link" onClick={onLoginClick}>
              Already have an account? Sign in
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
