import "../styles/Verification.css";

export default function UnverifiedSellerWarning({
  open,
  sellerName = "This seller",
  onCancel,
  onContinue,
}) {
  if (!open) return null;

  return (
    <section className="verification-modal-overlay" onClick={onCancel}>
      <section
        className="verification-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unverified-seller-title"
      >
        <span className="verification-modal__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.8 1.8 18A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-3l-8.5-14.2a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
        <h3 id="unverified-seller-title" className="verification-modal__title">Unverified Seller</h3>
        <p className="verification-modal__message">
          This seller has not verified their university email address. Continue with caution.
        </p>
        <p className="verification-modal__subtle">{sellerName}</p>
        <section className="verification-modal__actions">
          <button type="button" className="verification-modal__button verification-modal__button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="verification-modal__button verification-modal__button--primary" onClick={onContinue}>
            Continue Anyway
          </button>
        </section>
      </section>
    </section>
  );
}
