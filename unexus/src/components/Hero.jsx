import "../styles/Hero.css";

export default function Hero() {
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
            ["🛡️", "Verified Students"],
            ["🔄", "Secure Trade Center"],
            ["💳", "Safe Payments"],
          ].map(([icon, label]) => (
            <li key={label} className="hero__badge">
              <span>{icon}</span> {label}
            </li>
          ))}
        </ul>
      </header>

      {/* Floating Stat Cards */}
      <aside className="hero__stats" aria-label="Platform statistics">
        <article className="hero__stat-card hero__stat-card--glass">
          <p className="hero__stat-number">2,400+</p>
          <p className="hero__stat-label">Active Listings</p>
        </article>

        <article className="hero__stat-card hero__stat-card--green">
          <p className="hero__stat-number">8,900+</p>
          <p className="hero__stat-label">Students Joined</p>
        </article>
      </aside>
    </section>
  );
}
