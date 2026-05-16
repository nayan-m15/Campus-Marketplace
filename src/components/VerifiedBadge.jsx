import { getVerificationStatus } from "../utils/verification";
import "../styles/Verification.css";

export default function VerifiedBadge({
  user,
  isVerified,
  verifiedUniversity,
  className = "",
  compact = false,
  showUniversity = false,
}) {
  const resolvedStatus = getVerificationStatus({
    email: user?.email,
    is_verified: isVerified ?? user?.is_verified,
    verified_university: verifiedUniversity ?? user?.verified_university,
  });

  if (!resolvedStatus.isVerified) return null;

  const badgeClassName = [
    "verified-badge",
    compact ? "verified-badge--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={badgeClassName}>
      <span
        className="verified-badge__pill"
        title="Verified university student"
        aria-label="Verified university student"
      >
        <svg
          className="verified-badge__icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 12 2 2 4-4" />
          <path d="M12 3 6.5 5v5.4c0 3.7 2.3 7.1 5.5 8.6 3.2-1.5 5.5-4.9 5.5-8.6V5L12 3Z" />
        </svg>
        <span>{compact ? "Verified" : "Verified student"}</span>
      </span>
      {showUniversity && resolvedStatus.verifiedUniversity && (
        <span className="verified-badge__university">{resolvedStatus.verifiedUniversity}</span>
      )}
    </span>
  );
}
