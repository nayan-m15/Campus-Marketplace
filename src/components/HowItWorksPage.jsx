import "../styles/HowItWorks.css";

const studentSteps = [
  {
    title: "Open the website",
    description: "Start on CampusXchange to access the campus-only marketplace experience.",
  },
  {
    title: "Sign up or log in",
    description: "Create an account or return to your account to unlock marketplace actions.",
  },
  {
    title: "Complete profile setup",
    description: "Finish your profile details so buyers, sellers, and staff can coordinate safely.",
  },
  {
    title: "Browse listings using search and filters",
    description: "Use category, condition, and price filters to narrow down what you need quickly.",
  },
  {
    title: "Open listings to view details",
    description: "Check prices, item condition, descriptions, seller info, and transaction context.",
  },
  {
    title: "Save listings to wishlist",
    description: "Keep track of interesting items so you can compare options or return later.",
  },
  {
    title: "Message sellers",
    description: "Ask questions, discuss availability, and coordinate the next step directly in-app.",
  },
  {
    title: "Create listings",
    description: "Publish your own item with pricing, condition, category, and photos from the marketplace interface.",
  },
  {
    title: "Manage listings",
    description: "Use Your Listings to edit active items, update status, and keep your inventory current.",
  },
  {
    title: "Use the booking flow for facility handovers",
    description: "When a managed handover is needed, book a slot and follow the facility-based exchange process.",
  },
];

const roleHighlights = [
  {
    audience: "Students",
    eyebrow: "Student Journey",
    title: "Discover, connect, and complete safer campus trades.",
    description:
      "Students can browse listings, save items, message sellers, create listings, manage their activity, and use booking flows when a campus handover facility is required.",
    points: [
      "Marketplace browsing with search, filters, wishlist, and listing details",
      "Direct messaging for buyer-to-seller coordination and trade progress",
      "Listing creation and management from the same campus marketplace experience",
    ],
  },
  {
    audience: "Staff",
    eyebrow: "Operations Support",
    title: "Keep handovers moving smoothly behind the scenes.",
    description:
      "Staff support the operational side of the marketplace by managing trade facility workflows and helping users move through drop-off and collection steps.",
    points: [
      "View and manage booking workflows for facility-based exchanges",
      "Coordinate drop-offs and collections between marketplace users",
      "Support transaction progress when handovers need staff oversight",
    ],
  },
  {
    audience: "Admins",
    eyebrow: "Platform Control",
    title: "Protect trust and manage marketplace operations.",
    description:
      "Admins keep the platform healthy by moderating listings, managing operational settings, and reviewing marketplace performance.",
    points: [
      "Moderate listings and respond to risky or policy-breaking activity",
      "Manage facilities, booking settings, and staff access",
      "Generate reports and exports for marketplace oversight",
    ],
  },
];

const staffFeatures = [
  "View and manage booking workflows",
  "Coordinate drop-offs and collections",
  "Support transaction progress",
];

const adminFeatures = [
  "Moderate listings",
  "Manage facilities and booking settings",
  "Manage staff access",
  "Generate marketplace reports and exports",
];

function RoleSummaryCard({ eyebrow, audience, title, description, points }) {
  return (
    <article className="how-it-works__summary-card">
      <p className="how-it-works__eyebrow">{eyebrow}</p>
      <section className="how-it-works__summary-head">
        <span className="how-it-works__summary-audience">{audience}</span>
        <h3>{title}</h3>
      </section>
      <p className="how-it-works__summary-copy">{description}</p>
      <ul className="how-it-works__summary-list">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </article>
  );
}

function StudentStepCard({ index, title, description }) {
  return (
    <li className="how-it-works__step-card">
      <section className="how-it-works__step-marker" aria-hidden="true">
        <span>{index}</span>
      </section>
      <section className="how-it-works__step-content">
        <h3>{title}</h3>
        <p>{description}</p>
      </section>
    </li>
  );
}

function FeatureCard({ title, description, items, accent }) {
  return (
    <article className={`how-it-works__feature-card how-it-works__feature-card--${accent}`}>
      <section className="how-it-works__feature-icon" aria-hidden="true">
        <span />
      </section>
      <p className="how-it-works__eyebrow">{title}</p>
      <p className="how-it-works__feature-description">{description}</p>
      <ul className="how-it-works__feature-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

export default function HowItWorksPage({ onBrowseClick, onSignupClick, onLoginClick, user }) {
  return (
    <main className="how-it-works-page">
      <section className="how-it-works-hero">
        <figure className="how-it-works-hero__backdrop" aria-hidden="true" />
        <figure className="how-it-works-hero__mesh" aria-hidden="true" />

        <section className="how-it-works-hero__content">
          <p className="how-it-works__eyebrow">Marketplace Guide</p>
          <h1>How It Works</h1>
          <p className="how-it-works-hero__subtitle">
            From first browse to campus handover, CampusXchange helps students, staff,
            and admins move marketplace transactions forward with clearer steps.
          </p>

          <section className="how-it-works-hero__actions" aria-label="How it works actions">
            <button type="button" className="btn-primary" onClick={onBrowseClick}>
              Explore listings
            </button>
            {!user ? (
              <>
                <button type="button" className="btn-outline" onClick={onSignupClick}>
                  Create an account
                </button>
                <button type="button" className="how-it-works-hero__text-action" onClick={onLoginClick}>
                  Already registered? Log in
                </button>
              </>
            ) : null}
          </section>

          <section className="how-it-works-hero__signal-grid" aria-label="Marketplace flow overview">
            <article>
              <strong>Browse</strong>
              <span>Find campus listings with search, filters, and saved items.</span>
            </article>
            <article>
              <strong>Connect</strong>
              <span>Message sellers, negotiate details, and coordinate next steps.</span>
            </article>
            <article>
              <strong>Hand Over</strong>
              <span>Use bookings and staff-managed facilities when exchanges need structure.</span>
            </article>
          </section>
        </section>
      </section>

      <section className="how-it-works-section how-it-works-section--summary" aria-labelledby="how-it-works-overview">
        <section className="how-it-works-section__intro">
          <p className="how-it-works__eyebrow">Who Uses CampusXchange</p>
          <h2 id="how-it-works-overview">One marketplace, three operating views.</h2>
          <p>
            The platform supports student buying and selling, staff-managed handover workflows,
            and admin oversight for moderation, facilities, and reporting.
          </p>
        </section>

        <section className="how-it-works__summary-grid">
          {roleHighlights.map((highlight) => (
            <RoleSummaryCard key={highlight.audience} {...highlight} />
          ))}
        </section>
      </section>

      <section className="how-it-works-section" aria-labelledby="students-flow-heading">
        <section className="how-it-works-section__intro">
          <p className="how-it-works__eyebrow">For Students</p>
          <h2 id="students-flow-heading">The student journey from discovery to handover.</h2>
          <p>
            These are the main steps a student follows when using the marketplace end to end.
          </p>
        </section>

        <ol className="how-it-works__steps" aria-label="Student marketplace steps">
          {studentSteps.map((step, index) => (
            <StudentStepCard
              key={step.title}
              index={index + 1}
              title={step.title}
              description={step.description}
            />
          ))}
        </ol>
      </section>

      <section className="how-it-works-section" aria-labelledby="staff-flow-heading">
        <section className="how-it-works-section__intro">
          <p className="how-it-works__eyebrow">For Staff</p>
          <h2 id="staff-flow-heading">Staff keep facility-based exchanges organised.</h2>
          <p>
            Staff accounts work inside the trade facility workflow, helping users move through managed handovers.
          </p>
        </section>

        <FeatureCard
          title="Staff Workflow"
          description="When a transaction needs a managed handover, staff step in to keep bookings clear, timely, and trackable."
          items={staffFeatures}
          accent="staff"
        />
      </section>

      <section className="how-it-works-section" aria-labelledby="admin-flow-heading">
        <section className="how-it-works-section__intro">
          <p className="how-it-works__eyebrow">For Admins</p>
          <h2 id="admin-flow-heading">Admins manage trust, settings, and reporting.</h2>
          <p>
            Admin accounts oversee platform operations so the marketplace stays safe, useful, and well managed.
          </p>
        </section>

        <FeatureCard
          title="Admin Workflow"
          description="Admins balance marketplace quality and operational control across listings, facilities, staff access, and reporting."
          items={adminFeatures}
          accent="admin"
        />
      </section>
    </main>
  );
}
