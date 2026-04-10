import "../styles/Hero.css";
import { useState, useEffect, useRef } from "react";
import { fetchListings, CONDITION_COLORS } from "../data/listings";

export default function Hero({ onListingClick, onBrowseClick }) {

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  const [topListings, setTopListings] = useState([]);

  useEffect(() => {
    fetchListings()
      .then((data) => setTopListings(data.slice(0, 6)))
      .catch((err) => console.error("Hero failed to load listings:", err));
  }, []);

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
    if (!isPaused) {
      intervalRef.current = setInterval(() => {
        nextSlide();
      }, 4000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, currentSlide]);

  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  return (
    <section className="hero">
      {/* Backgrounds */}
      <figure className="hero__bg" aria-hidden="true" />
      <figure className="hero__overlay" aria-hidden="true" />

      {/* Main Content */}
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
            ["Verified Students"],
            ["Secure Trade Center"],
            ["Safe Payments"],
          ].map(([label]) => (
            <li key={label} className="hero__badge">
              {label}
            </li>
          ))}
        </ul>
      </header>

      {/* Carousel Section */}
      {topListings.length === 0 ? (
        <section className="hero__carousel" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                        <img src={listing.image_url} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

                      <button className="listing-button" onClick={() => onListingClick(listing)}>
                        View Details →
                      </button>
                    </section>

                  </article>
                </article>
              ))}
            </section>

            <button className="carousel-nav carousel-nav--prev" onClick={prevSlide} aria-label="Previous slide">‹</button>
            <button className="carousel-nav carousel-nav--next" onClick={nextSlide} aria-label="Next slide">›</button>

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
    </section>
  );
}