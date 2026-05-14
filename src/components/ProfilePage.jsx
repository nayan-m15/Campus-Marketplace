// Main structure for the profile page feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
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

/*This function returns the latest allowed birthdate.*/
function getMaxBirthdate() {
  const today = new Date();
  today.setFullYear(today.getFullYear() - 12);
  return today.toISOString().split("T")[0];
}

/*This function clamps the length.*/
function clampLength(value, maxLength) {
  return String(value ?? "").slice(0, maxLength);
}

/*This function parses the birthdate.*/
function parseBirthdate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/*This function returns whether the birthdate is valid.*/
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

/*This function renders the star display component.*/
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

/*This function renders the completion bar component.*/
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

// ── Main Component ───────────────────────────────────────────
export default function ProfilePage({ onBack, onAvatarChange, onNameChange}) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [memberSince, setMemberSince] = useState(null);
  const [phoneError, setPhoneError] = useState("");
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);

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

  /*This function handles province selection changes.*/
  const handleProvinceChange = (val) => {
    setForm((f) => ({ ...f, province: val, institution: "" }));
  };

  /*This function handles avatar selection changes.*/
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  /*This function updates a form field value.*/
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  /*This function shows the toast.*/
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  /*This function handles saving changes.*/
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
      showToast("✅ Profile saved!");
    } catch (err) {
      showToast("⚠️ " + err.message);
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

  /*This function formats the phone.*/
  function formatPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 10);

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  /*This function returns whether the phone number is valid.*/
  function isValidPhone(phone) {
    const digits = phone.replace(/\D/g, "");
    return /^(0[6-8]\d{8})$/.test(digits);
  }

  /*This function returns whether the phone number looks valid.*/
  function isNotFake(phone) {
    const digits = phone.replace(/\D/g, "");
    return !/^(\d)\1+$/.test(digits);
  }


  return (
    <article className="profile-page">
      {toast && <article className="profile-toast">{toast}</article>}

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

          {/* Form body */}
          <article className="profile-card__body">

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
          </article>

          <footer className="profile-card__footer">
            <button className="profile-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </footer>
        </article>
      </article>
    </article>
  );
}
