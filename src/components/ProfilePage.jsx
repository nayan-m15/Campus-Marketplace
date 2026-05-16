// Main structure for the profile page feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import "../styles/ProfilePage.css";

// ── Institutions by Province ─────────────────────────────────
const INSTITUTIONS_BY_PROVINCE = {
  "Gauteng": {
    public: [
      "University of the Witwatersrand (Wits)",
      "University of Pretoria (UP)",
      "University of Johannesburg (UJ)",
      "Tshwane University of Technology (TUT)",
      "Vaal University of Technology (VUT)",
      "UNISA",
    ],
    private: [
      // Private institutions are hidden for now. Uncomment these when they should be available again.
      // "Varsity College (Johannesburg / Pretoria)",
      // "Rosebank College (Johannesburg)",
      // "Boston City Campus (Johannesburg / Pretoria)",
      // "Damelin (Johannesburg / Pretoria)",
      // "IIE MSA (Midrand / Sandton)",
      // "Richfield Graduate Institute (Johannesburg)",
      // "Regent Business School (Johannesburg)",
      // "Milpark Business School",
      // "Regenesys Business School",
      // "MANCOSA (Johannesburg)",
      // "SACAP (Johannesburg)",
      // "Pearson Institute of Higher Education",
      // "Vega School (Johannesburg)",
      // "DC Academy",
      // "The Animation School (Johannesburg)",
      // "Academy of Learning (Johannesburg)",
    ],
  },
  "Western Cape": {
    public: [
      "University of Cape Town (UCT)",
      "Stellenbosch University",
      "University of the Western Cape (UWC)",
      "Cape Peninsula University of Technology (CPUT)",
    ],
    private: [
      // Private institutions are hidden for now. Uncomment these when they should be available again.
      // "Varsity College (Cape Town)",
      // "Rosebank College (Cape Town)",
      // "Boston City Campus (Cape Town)",
      // "Damelin (Cape Town)",
      // "Red & Yellow Creative School",
      // "Open Window School of Visual Communication",
      // "Inscape Design College (Cape Town)",
      // "Greenside Design Center (Cape Town)",
      // "AFDA (Cape Town)",
      // "Cornerstone Institute",
      // "CityVarsity",
      // "SACAP (Cape Town)",
      // "IMM Graduate School (Cape Town)",
    ],
  },
  "KwaZulu-Natal": {
    public: [
      "University of KwaZulu-Natal (UKZN)",
      "Durban University of Technology (DUT)",
      "Mangosuthu University of Technology (MUT)",
      "University of Zululand",
    ],
    private: [
      // Private institutions are hidden for now. Uncomment these when they should be available again.
      // "Varsity College (Durban / Westville)",
      // "Rosebank College (Durban)",
      // "Boston City Campus (Durban)",
      // "Damelin (Durban)",
      // "Richfield Graduate Institute (Durban)",
      // "MANCOSA (Durban)",
      // "SACAP (Durban)",
      // "IMM Graduate School (Durban)",
    ],
  },
  "Eastern Cape": {
    public: [
      "Rhodes University",
      "Walter Sisulu University",
      "Nelson Mandela University",
      "University of Fort Hare",
    ],
    private: [
      // Private institutions are hidden for now. Uncomment these when they should be available again.
      // "Varsity College (East London / Port Elizabeth)",
      // "Boston City Campus (Port Elizabeth)",
      // "Damelin (Port Elizabeth)",
      // "Richfield Graduate Institute (East London)",
    ],
  },
  "Free State": {
    public: [
      "University of the Free State (UFS)",
      "Central University of Technology (CUT)",
    ],
    private: [
      // Private institutions are hidden for now. Uncomment these when they should be available again.
      // "Varsity College (Bloemfontein)",
      // "Boston City Campus (Bloemfontein)",
      // "Damelin (Bloemfontein)",
      // "Academy of Learning (Bloemfontein)",
    ],
  },
  "North West": {
    public: [
      "North-West University (NWU)",
    ],
    private: [
      // Private institutions are hidden for now. Uncomment these when they should be available again.
      // "Varsity College (Potchefstroom)",
      // "Boston City Campus (Rustenburg)",
      // "Academy of Learning (Rustenburg)",
    ],
  },
  "Limpopo": {
    public: [
      "University of Limpopo",
    ],
    private: [
      // Private institutions are hidden for now. Uncomment these when they should be available again.
      // "Boston City Campus (Polokwane)",
      // "Richfield Graduate Institute (Polokwane)",
      // "Academy of Learning (Polokwane)",
    ],
  },
  "Mpumalanga": {
    public: [
      "University of Mpumalanga",
    ],
    private: [
      // Private institutions are hidden for now. Uncomment these when they should be available again.
      // "Boston City Campus (Nelspruit)",
      // "Academy of Learning (Nelspruit)",
    ],
  },
  "Northern Cape": {
    public: [
      "Sol Plaatje University",
    ],
    private: [
      // Private institutions are hidden for now. Uncomment these when they should be available again.
      // "Academy of Learning (Kimberley)",
    ],
  },
};

const PROVINCES = Object.keys(INSTITUTIONS_BY_PROVINCE);
const PROFILE_NAME_MAX = 80;
const PROFILE_DISPLAY_NAME_MAX = 40;
const PROFILE_ABOUT_MAX = 300;
const PROFILE_PHONE_MAX = 15;
const MIN_BIRTHDATE = "1900-01-01";

// Small prep work happens in this helper before the UI uses the result.
// It keeps lookup, formatting, or data shaping out of the render path.
function getMaxBirthdate() {
  const today = new Date();
  today.setFullYear(today.getFullYear() - 12);
  return today.toISOString().split("T")[0];
}

// A focused piece of component behavior is handled here.
// Keeping it separate makes the main flow less crowded.
function clampLength(value, maxLength) {
  return String(value ?? "").slice(0, maxLength);
}

// Small prep work happens in this helper before the UI uses the result.
// It keeps lookup, formatting, or data shaping out of the render path.
function parseBirthdate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Quick guard logic sits here for this decision point.
// The check keeps the rest of the flow cleaner to read.
function isValidBirthdate(value) {
  if (!value) return true;

  const date = parseBirthdate(value);
  if (!date) return false;

  const minDate = new Date(MIN_BIRTHDATE);
  if (date < minDate) return false;

  const today = new Date();

  const minAge = new Date(
    today.getFullYear() - 12,
    today.getMonth(),
    today.getDate()
  );

  if (date > minAge) return false;

  return true;
}

// ── Star display (read-only) ─────────────────────────────────
function StarDisplay({ average = 0, count = 0 }) {
  return (
    <section className="pub-rating__display">
      <section className="pub-rating__stars">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = average >= i;
          const half = !filled && average >= i - 0.5;
          return (
            <span
              key={i}
              className={`pub-rating__star ${filled ? "pub-rating__star--filled" : half ? "pub-rating__star--half" : ""}`}
            >
              ★
            </span>
          );
        })}
      </section>
      <span className="pub-rating__label">
        {count > 0
          ? `${average} (${count} review${count !== 1 ? "s" : ""})`
          : "No reviews yet"}
      </span>
    </section>
  );
}

// ── Profile completion config ────────────────────────────────
const COMPLETION_FIELDS = [
  { key: "avatar", label: "Profile photo" },
  { key: "name", label: "Full name" },
  { key: "display_name", label: "Display name" },
  { key: "about", label: "About you" },
  { key: "province", label: "Province" },
  { key: "institution", label: "Institution" },
  { key: "birthdate", label: "Date of birth" },
  { key: "sex", label: "Sex" },
  { key: "phone", label: "Phone number" },
];

// ── Completion Bar ───────────────────────────────────────────
function CompletionBar({ form, avatarPreview }) {
  const filled = COMPLETION_FIELDS.filter(({ key }) => {
    if (key === "avatar") return !!avatarPreview;
    return !!form[key];
  });
  const pct = Math.round((filled.length / COMPLETION_FIELDS.length) * 100);
    const color = pct < 40 ? "var(--danger)" : pct < 75 ? "var(--amber)" : "var(--green)";
  const missing = COMPLETION_FIELDS.filter(({ key }) => {
    if (key === "avatar") return !avatarPreview;
    return !form[key];
  });

  return (
    <article className="profile-completion">
      <header className="profile-completion__header">
        <span className="profile-completion__label">Profile completeness</span>
        <span className="profile-completion__pct" style={{ color }}>{pct}%</span>
      </header>
      <article className="profile-completion__track">
        <article
          className="profile-completion__fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </article>
      {missing.length > 0 && (
        <p className="profile-completion__hint">
          Still missing: {missing.map((f) => f.label).join(", ")}
        </p>
      )}
    </article>
  );
}

function getListingImage(listing) {
  if (!listing) return "";
  if (listing.image_url) return listing.image_url;
  if (Array.isArray(listing.image_urls)) return listing.image_urls.find(Boolean) || "";
  return "";
}

function mapRpcTransactionHistory(rows) {
  return (rows || [])
    .filter((row) => row?.transaction_id)
    .map((row) => ({
      id: row.transaction_id,
      itemTitle: row.item_title || "Transaction item",
      imageUrl: row.item_image_url || "",
      otherUserName: row.other_user_name || "Unknown user",
      relationshipLabel: row.relationship_label || "Traded with",
    }));
}

function TransactionHistory({ transactions, loading }) {
  if (loading) {
    return <p className="pub-transactions__empty">Loading transaction history...</p>;
  }

  if (transactions.length === 0) {
    return (
      <section className="pub-transactions__empty-card">
        <p>No transaction history yet.</p>
      </section>
    );
  }

  return (
    <ul className="pub-transactions__list">
      {transactions.map((transaction) => (
        <li key={transaction.id} className="pub-transaction">
          <figure className="pub-transaction__image">
            {transaction.imageUrl ? (
              <img src={transaction.imageUrl} alt={transaction.itemTitle} />
            ) : (
              <span>{transaction.itemTitle?.[0]?.toUpperCase() || "I"}</span>
            )}
          </figure>
          <section className="pub-transaction__body">
            <strong>{transaction.itemTitle}</strong>
            <span>{transaction.relationshipLabel} {transaction.otherUserName}</span>
          </section>
        </li>
      ))}
    </ul>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function ProfilePage({ onBack, onAvatarChange, onNameChange}) {
  const { user } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [memberSince, setMemberSince] = useState(null);
  const [phoneError, setPhoneError] = useState("");
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [activeTab, setActiveTab] = useState("edit");
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    display_name: "",
    about: "",
    province: "",
    institution: "",
    birthdate: "",
    sex: "",
    phone: "",
  });

  // Institutions available for the selected province
  const provinceData = INSTITUTIONS_BY_PROVINCE[form.province];
  const availableInstitutions = provinceData
    ? [
        { group: "Public Universities", items: provinceData.public },
        // Private institutions are hidden for now. Uncomment this group to show them again.
        // { group: "Private Colleges & Universities", items: provinceData.private },
      ]
    : [];

  // Load profile on mount
  useEffect(() => {
    if (!user) return;

    if (user.created_at) {
      setMemberSince(
        new Date(user.created_at).toLocaleDateString("en-ZA", {
          month: "long",
          year: "numeric",
        })
      );
    }

    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            name: data.name || "",
            display_name: data.display_name || "",
            about: data.about || "",
            province: data.province || "",
            institution: data.institution || "",
            birthdate: data.birthdate || "",
            sex: data.sex || "",
            phone: data.phone || "",
          });
          if (data.avatar_url) setAvatarPreview(data.avatar_url);
          setRatingAvg(parseFloat(data.avg_rating) || 0);
          setRatingCount(parseInt(data.rating_count) || 0);
        }
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    async function loadTransactionHistory() {
      setTransactionsLoading(true);

      try {
        const { data: rpcRows, error: rpcError } = await supabase.rpc(
          "get_public_transaction_history",
          { p_profile_user_id: user.id }
        );

        const rpcHistory = !rpcError ? mapRpcTransactionHistory(rpcRows) : [];
        if (rpcHistory.length > 0) {
          if (!cancelled) setTransactionHistory(rpcHistory);
          return;
        }

        const { data: rows, error } = await supabase
          .from("transactions")
          .select("id, item, listing_id, requested_listing_id, offered_listing_id, seller_id, buyer_id, transaction_type, status, created_at")
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const transactions = rows || [];
        const listingIds = [
          ...new Set(
            transactions
              .flatMap((transaction) => [
                transaction.listing_id,
                transaction.requested_listing_id,
                transaction.offered_listing_id,
              ])
              .filter(Boolean)
          ),
        ];
        const otherUserIds = [
          ...new Set(
            transactions
              .map((transaction) =>
                transaction.seller_id === user.id ? transaction.buyer_id : transaction.seller_id
              )
              .filter(Boolean)
          ),
        ];

        const [{ data: listings }, { data: profiles }] = await Promise.all([
          listingIds.length
            ? supabase
                .from("listings")
                .select("id, title, image_url, image_urls")
                .in("id", listingIds)
            : Promise.resolve({ data: [] }),
          otherUserIds.length
            ? supabase
                .from("profiles")
                .select("id, display_name, name")
                .in("id", otherUserIds)
            : Promise.resolve({ data: [] }),
        ]);

        const listingById = Object.fromEntries((listings || []).map((listing) => [listing.id, listing]));
        const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));

        const history = transactions.map((transaction) => {
          const isSeller = transaction.seller_id === user.id;
          const otherUserId = isSeller ? transaction.buyer_id : transaction.seller_id;
          const listingId =
            transaction.listing_id ||
            transaction.requested_listing_id ||
            transaction.offered_listing_id;
          const listing = listingById[listingId] || null;
          const otherProfile = profileById[otherUserId] || null;
          const otherUserName =
            otherProfile?.display_name ||
            otherProfile?.name ||
            (otherUserId ? String(otherUserId).slice(0, 8) : "Unknown user");

          return {
            id: transaction.id,
            itemTitle: listing?.title || transaction.item || "Transaction item",
            imageUrl: getListingImage(listing),
            otherUserName,
            relationshipLabel: isSeller ? "Sold to" : "Bought from",
          };
        });

        if (!cancelled) setTransactionHistory(history);
      } catch (err) {
        console.error("Failed to load transaction history:", err.message);
        if (!cancelled) setTransactionHistory([]);
      } finally {
        if (!cancelled) setTransactionsLoading(false);
      }
    }

    loadTransactionHistory();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Clear institution when province changes
  const handleProvinceChange = (val) => {
    setForm((f) => ({ ...f, province: val, institution: "" }));
  };

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const showToast = (msg, type = "success") => {
    if (type === "error") {
      notifyError("Profile update failed", msg, { category: "profile", dedupeKey: `profile-error-${msg}` });
      return;
    }

    notifySuccess("Profile updated", msg, { category: "profile", dedupeKey: `profile-success-${msg}` });
  };

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      if (!isValidBirthdate(form.birthdate)) {
        throw new Error("Please enter a valid date of birth.");
      }

      const digits = form.phone.replace(/\D/g, "");

      if (digits && (!isValidPhone(digits) || !isNotFake(digits))) {
        throw new Error("Please enter a valid phone number.");
      }
      
      let avatarUrl = avatarPreview;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const filePath = `${user.id}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw new Error("Avatar upload failed: " + uploadError.message);

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;
        setAvatarPreview(avatarUrl);
        setAvatarFile(null);
        onAvatarChange?.(avatarUrl);
      }

      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email,
          name: form.name.trim() || null,
          display_name: form.display_name.trim() || null,
          about: form.about.trim() || null,
          province: form.province || null,
          institution: form.institution || null,
          birthdate: form.birthdate || null,
          sex: form.sex || null,
          phone: form.phone ? form.phone.replace(/\D/g, "") : null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (error) throw new Error(error.message);
      onNameChange?.(form.display_name.trim() || form.name.trim());
      showToast("Profile saved!");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.name || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (loading) {
    return (
      <section style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-400)" }}>
        Loading profile…
      </section>
    );
  }

  // Small prep work happens in this helper before the UI uses the result.
  // It keeps lookup, formatting, or data shaping out of the render path.
  function formatPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 10);

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  // Quick guard logic sits here for this decision point.
  // The check keeps the rest of the flow cleaner to read.
  function isValidPhone(phone) {
    const digits = phone.replace(/\D/g, "");
    return /^(0[6-8]\d{8})$/.test(digits);
  }

  // Quick guard logic sits here for this decision point.
  // The check keeps the rest of the flow cleaner to read.
  function isNotFake(phone) {
    const digits = phone.replace(/\D/g, "");
    return !/^(\d)\1+$/.test(digits);
  }


  return (
    <article className="profile-page">
      <article className="profile-page__inner">
        <button className="profile-page__back" onClick={onBack}>← Back</button>

        {/* Completion bar */}
        <article className="profile-card">
          <section style={{ padding: "20px 32px" }}>
            <CompletionBar form={form} avatarPreview={avatarPreview} />
          </section>
        </article>

        <article className="profile-card">
          {/* Avatar header */}
          <article className="profile-card__avatar-section">
            <article className="profile-card__avatar-wrap">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="profile-card__avatar" />
              ) : (
                <article className="profile-card__avatar-placeholder">{initials}</article>
              )}
              <button
                className="profile-card__avatar-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change profile photo"
                type="button"
              >
                📷
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </article>

            <article className="profile-card__avatar-info">
              <h2>{form.display_name || form.name || "Your Profile"}</h2>
              <p>{user?.email}</p>
              <StarDisplay average={ratingAvg} count={ratingCount} />
              {memberSince && (
                <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 4 }}>
                  🗓 Member since {memberSince}
                </p>
              )}
            </article>
          </article>

          <nav className="profile-tabs" aria-label="Profile sections">
            <button
              type="button"
              className={`profile-tabs__button${activeTab === "edit" ? " profile-tabs__button--active" : ""}`}
              onClick={() => setActiveTab("edit")}
            >
              Edit profile
            </button>
            <button
              type="button"
              className={`profile-tabs__button${activeTab === "transactions" ? " profile-tabs__button--active" : ""}`}
              onClick={() => setActiveTab("transactions")}
            >
              Transaction history
            </button>
          </nav>

          {/* Form body */}
          <article className="profile-card__body">
            {activeTab === "transactions" ? (
              <>
                <p className="profile-section-title">Transaction History</p>
                <TransactionHistory transactions={transactionHistory} loading={transactionsLoading} />
              </>
            ) : (
              <>

            <p className="profile-section-title">Personal</p>

            <article className="profile-field-row">
              <article className="profile-field">
                <label htmlFor="pf-name">Full name</label>
                <input
                  id="pf-name"
                  type="text"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(e) => set("name", clampLength(e.target.value, PROFILE_NAME_MAX))}
                  maxLength={PROFILE_NAME_MAX}
                />
              </article>
              <article className="profile-field">
                <label htmlFor="pf-display">Display name</label>
                <input
                  id="pf-display"
                  type="text"
                  placeholder="Shown on listings"
                  value={form.display_name}
                  onChange={(e) => set("display_name", clampLength(e.target.value, PROFILE_DISPLAY_NAME_MAX))}
                  maxLength={PROFILE_DISPLAY_NAME_MAX}
                />
              </article>
            </article>

            <article className="profile-field-row">
              <article className="profile-field">
                <label htmlFor="pf-sex">Sex</label>
                <select id="pf-sex" value={form.sex} onChange={(e) => set("sex", e.target.value)}>
                  <option value="">Select…</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Prefer not to say</option>
                </select>
              </article>
              <article className="profile-field">
                <label htmlFor="pf-birthdate">Date of birth</label>
                <input
                  id="pf-birthdate"
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => set("birthdate", e.target.value)}
                  min={MIN_BIRTHDATE}
                  max={getMaxBirthdate()}
                />
              </article>
            </article>

            <article className="profile-field">
              <label htmlFor="pf-about">About you</label>
              <textarea
                id="pf-about"
                placeholder="A short bio — what you're studying, what you sell, anything buyers should know…"
                value={form.about}
                onChange={(e) => set("about", clampLength(e.target.value, PROFILE_ABOUT_MAX))}
                maxLength={PROFILE_ABOUT_MAX}
              />
              <span className="profile-field__hint">{form.about.length}/{PROFILE_ABOUT_MAX}</span>
            </article>

            <p className="profile-section-title">Location & Institution</p>

            <article className="profile-field-row">
              <article className="profile-field">
                <label htmlFor="pf-province">Province</label>
                <select
                  id="pf-province"
                  value={form.province}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                >
                  <option value="">Select province…</option>
                  {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </article>

              <article className="profile-field">
                <label htmlFor="pf-institution">
                  University / College
                  {!form.province && (
                    <span style={{ fontWeight: 400, color: "#bbb", marginLeft: 6 }}>
                      (select province first)
                    </span>
                  )}
                </label>
                <select
                  id="pf-institution"
                  value={form.institution}
                  onChange={(e) => set("institution", e.target.value)}
                  disabled={!form.province}
                >
                  <option value="">
                    {form.province ? "Select institution…" : "Select province first"}
                  </option>
                  {availableInstitutions.map(({ group, items }) => (
                    <optgroup key={group} label={group}>
                      {items.map((i) => <option key={i}>{i}</option>)}
                    </optgroup>
                  ))}
                </select>
              </article>
            </article>

            <p className="profile-section-title">Contact</p>

            <article className="profile-field-row">
              <article className="profile-field">
                <label htmlFor="pf-phone">Phone number</label>
                <input
                  id="pf-phone"
                  type="tel"
                  placeholder="e.g. 071 234 5678"
                  value={form.phone}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    set("phone", formatted);

                    const digits = formatted.replace(/\D/g, "");
                  if (!digits) {
                    setPhoneError("");
                  } else if (!isValidPhone(digits)) {
                    setPhoneError("Enter a valid SA mobile number");
                  } else if (!isNotFake(digits)) {
                    setPhoneError("That number looks fake");
                  } else {
                    setPhoneError("");
                  }
                  }}
                />
                {phoneError && (
                  <span className="profile-field__error">{phoneError}</span>
                )}
            </article>
            </article>
              </>
            )}
          </article>

          {activeTab === "edit" && (
          <footer className="profile-card__footer">
            <button className="profile-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </footer>
          )}
        </article>
      </article>
    </article>
  );
}
