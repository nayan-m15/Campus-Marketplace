// Main structure for the footer feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

export default function Footer() {
  return (
    <footer
      style={{
        background: "var(--grad-cta)",
        color: "rgba(255,253,248,0.82)",
        textAlign: "center",
        padding: "24px 32px",
        fontSize: 13,
        marginTop: 40,
      }}
    >
      <p>
        <strong style={{ color: "var(--amber)" }}>CAMPUSXCHANGE</strong>{" "}
        — Student marketplace. Safe. Local. Trusted.
      </p>
    </footer>
  );
}
